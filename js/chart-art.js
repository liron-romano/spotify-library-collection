import { escapeHtml, normalizeStr } from './utils.js';
import { searchSpotifyAlbum } from './spotify-api.js';
import { isOwned, getOverride, loadChartArtCache, saveChartArtCache } from './persistence.js';
import { PLACEHOLDER_IMG, hydrateSingleImage } from './image-hydration.js';

/* iTunes Search API — no key required, CORS-enabled, decent hit rate as a second opinion. */
async function searchItunesAlbum(artist, title){
  const q = encodeURIComponent(`${artist} ${title}`);
  try{
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=album&limit=1`);
    if(!res.ok) return null;
    const data = await res.json();
    const item = data.results && data.results[0];
    if(!item || !item.artworkUrl100) return null;
    return {
      image: item.artworkUrl100.replace('100x100bb', '600x600bb'),
      url: item.collectionViewUrl || '',
      source: 'itunes'
    };
  }catch(e){ return null; }
}

/* MusicBrainz + Cover Art Archive — last resort, catches obscure/out-of-print releases.
   MusicBrainz asks that unauthenticated clients stay around 1 request/second, so calls
   here are queued through a shared throttle rather than fired concurrently. */
let mbQueue = Promise.resolve();
function mbThrottled(fn){
  const run = mbQueue.then(() => fn().finally(() => new Promise(r => setTimeout(r, 1100))));
  mbQueue = run.catch(() => {});
  return run;
}
async function mbQueryReleaseGroups(query){
  const res = await fetch(`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=5`, {
    headers: { Accept: 'application/json' }
  });
  if(!res.ok) return [];
  const data = await res.json();
  return data['release-groups'] || [];
}
async function searchMusicBrainzAlbum(artist, title){
  return mbThrottled(async () => {
    try{
      // Exact-phrase match first — best precision when the chart's title matches
      // MusicBrainz's canonical spelling exactly.
      let groups = await mbQueryReleaseGroups(`releasegroup:"${title}" AND artist:"${artist}"`);
      if(groups.length === 0){
        // Exact phrase found nothing — MusicBrainz's own title may differ slightly
        // (abbreviations like "Yr." vs "Your", punctuation, "&" vs "and", exclamation
        // marks, etc.), so retry with an unquoted, non-phrase query and let relevance
        // scoring pick the closest match instead of requiring an exact string.
        await new Promise(r => setTimeout(r, 1100));
        groups = await mbQueryReleaseGroups(`releasegroup:(${title}) AND artist:(${artist})`);
      }
      const rg = groups[0];
      if(!rg) return null;
      const image = `https://coverartarchive.org/release-group/${rg.id}/front-250`;
      const check = await fetch(image, { method: 'HEAD' }).catch(() => null);
      if(!check || !check.ok) return null;
      return {
        image,
        url: `https://musicbrainz.org/release-group/${rg.id}`,
        source: 'musicbrainz'
      };
    }catch(e){ return null; }
  });
}

/* Tries Spotify's own search first (best match quality, needs the user's token),
   then falls back to iTunes, then MusicBrainz/Cover Art Archive for anything still missing. */
const ART_SOURCE_ORDER = ['spotify', 'itunes', 'musicbrainz'];
export async function findChartArt(token, artist, title){
  if(token){
    const s = await searchSpotifyAlbum(token, artist, title).catch(() => null);
    if(s && s.image) return s;
  }
  const it = await searchItunesAlbum(artist, title);
  if(it && it.image) return it;
  const mb = await searchMusicBrainzAlbum(artist, title);
  if(mb && mb.image) return mb;
  return null;
}

/* Used by the "Try next source" button when someone flags a pick as wrong — walks the
   provider order starting just past whichever source produced the current image. */
export async function tryNextArtSource(token, artist, title, currentSource){
  let startIdx = ART_SOURCE_ORDER.indexOf(currentSource);
  for(let i = startIdx + 1; i < ART_SOURCE_ORDER.length; i++){
    const src = ART_SOURCE_ORDER[i];
    let result = null;
    if(src === 'spotify'){ if(token) result = await searchSpotifyAlbum(token, artist, title).catch(() => null); }
    else if(src === 'itunes') result = await searchItunesAlbum(artist, title);
    else if(src === 'musicbrainz') result = await searchMusicBrainzAlbum(artist, title);
    if(result && result.image) return result;
  }
  return null;
}

export function applyChartArt(elId, label, q, result, key, artist, title){
  const el = document.getElementById(elId);
  if(!el) return;
  const owned = isOwned(key);
  const override = getOverride(key);
  const isOverride = !!(override && result && override.image === result.image);
  const toggleBtn = `<button class="mu-owned-toggle${owned ? ' active' : ''}" type="button" data-key="${key}" data-artist="${escapeHtml(artist)}" data-title="${escapeHtml(title)}" title="${owned ? 'Marked as in your library' : 'Mark as in your library'}">${owned ? '✓' : '+'}</button>`;
  const editBtn = `<button class="mu-art-edit-toggle" type="button" data-key="${key}" data-artist="${escapeHtml(artist)}" data-title="${escapeHtml(title)}" data-el-id="${elId}" title="Fix wrong artwork">✎</button>`;
  if(!result || !result.image){
    // No art found anywhere — keep the text fallback, but make sure both buttons are present.
    el.classList.toggle('owned', owned);
    if(!el.querySelector('.mu-owned-toggle')) el.insertAdjacentHTML('beforeend', toggleBtn);
    if(!el.querySelector('.mu-art-edit-toggle')) el.insertAdjacentHTML('beforeend', editBtn);
    return;
  }
  const clickable = !!result.url;
  const tag = clickable ? 'a' : 'div';
  const linkAttrs = clickable ? `href="${result.url}" target="_blank" rel="noopener"` : '';
  el.outerHTML = `<${tag} class="mu-cell grayed${owned ? ' owned' : ''}${isOverride ? ' override' : ''}" id="${elId}" ${linkAttrs} title="${label}" data-q="${q}" data-key="${key}" data-artist="${escapeHtml(artist)}" data-title="${escapeHtml(title)}">
    <img src="${PLACEHOLDER_IMG}" data-src="${result.image}" alt="${label}" loading="lazy">
    ${toggleBtn}${editBtn}
  </${tag}>`;
  const newEl = document.getElementById(elId);
  const img = newEl && newEl.querySelector('img[data-src]');
  if(img) hydrateSingleImage(img);
}

export async function hydrateChartArt(muFlat){
  const token = localStorage.getItem('access_token');
  const cache = loadChartArtCache();
  const pending = [];
  muFlat.forEach(cell => {
    if(cell.match) return;
    const key = normalizeStr(cell.artist) + '|' + normalizeStr(cell.title);
    if(getOverride(key)) return; // already rendered with the manual override — no lookup needed
    const elId = 'mu-' + cell.id;
    const label = escapeHtml(`${cell.title} — ${cell.artist}`);
    const q = escapeHtml((cell.artist + ' ' + cell.title).toLowerCase());
    if(Object.prototype.hasOwnProperty.call(cache, key)){
      applyChartArt(elId, label, q, cache[key], key, cell.artist, cell.title);
    } else {
      pending.push({ key, elId, label, q, artist: cell.artist, title: cell.title });
    }
  });
  if(pending.length === 0) return;
  const CONCURRENCY = 5;
  let idx = 0;
  async function worker(){
    while(idx < pending.length){
      const item = pending[idx++];
      let result = null;
      try{ result = await findChartArt(token, item.artist, item.title); }catch(e){ result = null; }
      cache[item.key] = result;
      applyChartArt(item.elId, item.label, item.q, result, item.key, item.artist, item.title);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  saveChartArtCache(cache);
}
