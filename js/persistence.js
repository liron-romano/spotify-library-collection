import { fetchSpotifyUserId } from './spotify-api.js';

/* ============ CHART ART CACHE (auto-found artwork, survives refresh) ============ */
const CHART_ART_CACHE_KEY = 'mu_chart_art_cache_v1';
export function loadChartArtCache(){
  try{ return JSON.parse(localStorage.getItem(CHART_ART_CACHE_KEY) || '{}'); }catch(e){ return {}; }
}
export function saveChartArtCache(cache){
  try{ localStorage.setItem(CHART_ART_CACHE_KEY, JSON.stringify(cache)); }catch(e){}
}

/* ============ OWNED (MARKED AS "IN YOUR LIBRARY") TRACKING ============
   For /mu/ albums that aren't on Spotify at all — e.g. ones you downloaded locally —
   this lets you flag them as "in your library" independent of Spotify's own data. */
const OWNED_KEY = 'mu_owned_albums_v1';
export function loadOwned(){
  try{ return JSON.parse(localStorage.getItem(OWNED_KEY) || '{}'); }catch(e){ return {}; }
}
export function saveOwned(obj){
  try{ localStorage.setItem(OWNED_KEY, JSON.stringify(obj)); }catch(e){}
}
export function isOwned(key){
  const o = loadOwned();
  return !!(o[key] && o[key].owned);
}
export function setOwned(key, artist, title, owned){
  const o = loadOwned();
  o[key] = { owned, artist, title, updatedAt: Date.now() };
  saveOwned(o);
  scheduleSyncPush();
  return o[key];
}

/* ============ MANUAL ARTWORK OVERRIDES ============
   For when the automatic lookup (Spotify/iTunes/MusicBrainz) picks the wrong cover —
   e.g. a live album, a deluxe reissue, or a same-named album by someone else. Overrides
   always take priority over the automatic lookup and its cache. */
const ART_OVERRIDE_KEY = 'mu_chart_art_override_v1';
export function loadOverrides(){
  try{ return JSON.parse(localStorage.getItem(ART_OVERRIDE_KEY) || '{}'); }catch(e){ return {}; }
}
export function saveOverrides(obj){
  try{ localStorage.setItem(ART_OVERRIDE_KEY, JSON.stringify(obj)); }catch(e){}
}
export function getOverride(key){
  const o = loadOverrides();
  return o[key] || null;
}
export function setOverride(key, artist, title, image, url){
  const o = loadOverrides();
  o[key] = { image, url: url || '', source: 'manual', artist, title, updatedAt: Date.now() };
  saveOverrides(o);
  scheduleSyncPush();
  return o[key];
}
export function clearOverride(key){
  const o = loadOverrides();
  delete o[key];
  saveOverrides(o);
  scheduleSyncPush();
}

/* ============ CROSS-DEVICE SYNC (optional) ============
   Pure client-side localStorage only survives on one browser/device. To carry "owned"
   marks and artwork fixes across devices you need somewhere to store them server-side —
   see the Sync settings modal and the deployment notes for a small hosted key-value endpoint. */
let syncPushTimer = null;
export function scheduleSyncPush(){
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(() => syncPushAll(), 800);
}
export function getSyncConfig(){
  const url = localStorage.getItem('sync_url');
  const token = localStorage.getItem('sync_token');
  const user = localStorage.getItem('spotify_user_id');
  if(!url || !token || !user) return null;
  return { url: url.replace(/\/+$/,''), token, user };
}
function mergeOwned(local, remote){
  const merged = Object.assign({}, local);
  Object.entries(remote || {}).forEach(([k, v]) => {
    if(!merged[k] || (v.updatedAt||0) > (merged[k].updatedAt||0)) merged[k] = v;
  });
  return merged;
}
export async function syncPull(){
  const cfg = getSyncConfig();
  if(!cfg) return null;
  try{
    const res = await fetch(`${cfg.url}/owned?user=${encodeURIComponent(cfg.user)}`, {
      headers: { Authorization: 'Bearer ' + cfg.token }
    });
    if(!res.ok) return null;
    const remote = await res.json() || {};
    // Backward-compatible with an older deploy that synced a bare "owned" blob with no wrapper.
    const remoteOwned = remote.owned || (!remote.artOverrides ? remote : {});
    const remoteOverrides = remote.artOverrides || {};
    const mergedOwned = mergeOwned(loadOwned(), remoteOwned);
    const mergedOverrides = mergeOwned(loadOverrides(), remoteOverrides);
    saveOwned(mergedOwned);
    saveOverrides(mergedOverrides);
    return { owned: mergedOwned, artOverrides: mergedOverrides };
  }catch(e){ return null; }
}
export async function syncPushAll(){
  const cfg = getSyncConfig();
  if(!cfg) return;
  try{
    await fetch(`${cfg.url}/owned?user=${encodeURIComponent(cfg.user)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.token },
      body: JSON.stringify({ owned: loadOwned(), artOverrides: loadOverrides() })
    });
  }catch(e){}
}

// Re-exported here purely so callers that need "identify the current Spotify user
// before syncing" don't need a second import from spotify-api.js.
export { fetchSpotifyUserId };
