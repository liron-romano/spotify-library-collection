import { escapeHtml, normalizeStr, stripEdition } from './utils.js';
import { MU_CORE, MU_SECTIONS, MU_CLASSICS_SECTIONS } from './mu-data.js';
import { isOwned, getOverride } from './persistence.js';
import { PLACEHOLDER_IMG } from './image-hydration.js';

export function findLibraryMatch(chartArtist, chartAlbum, library){
  const na = normalizeStr(chartArtist);
  const nt = normalizeStr(stripEdition(chartAlbum));
  if(!na || !nt) return undefined;
  return library.find(a => {
    const la = normalizeStr(a.artist);
    const lt = normalizeStr(stripEdition(a.name));
    if(!la || !lt) return false;
    const artistMatch = la === na || la.includes(na) || na.includes(la);
    const titleMatch = lt === nt || lt.includes(nt) || nt.includes(lt);
    return artistMatch && titleMatch;
  });
}

export function computeMuCells(library){
  const mapEntry = (idPrefix) => ([artist, title], i) => ({ id: `${idPrefix}-${i}`, artist, title, match: findLibraryMatch(artist, title, library) });
  return {
    core: MU_CORE.map(mapEntry('core')),
    sections: Object.fromEntries(Object.entries(MU_SECTIONS).map(([k, v]) => [k, v.map(mapEntry(k))])),
    classicsSections: Object.fromEntries(Object.entries(MU_CLASSICS_SECTIONS).map(([k, v]) => [k, v.map(mapEntry('classics-' + k))]))
  };
}

export function muCellHtml(cell){
  const label = escapeHtml(`${cell.title} — ${cell.artist}`);
  const q = escapeHtml((cell.artist + ' ' + cell.title).toLowerCase());
  const elId = 'mu-' + cell.id;
  if(cell.match){
    return `<a class="mu-cell" id="${elId}" href="${cell.match.url}" target="_blank" rel="noopener" title="${label}" data-q="${q}">
      <img src="${PLACEHOLDER_IMG}" data-src="${cell.match.image}" alt="${label}" loading="lazy">
    </a>`;
  }
  const key = escapeHtml(normalizeStr(cell.artist) + '|' + normalizeStr(cell.title));
  const owned = isOwned(key);
  const override = getOverride(key);
  const ownedBtn = `<button class="mu-owned-toggle${owned ? ' active' : ''}" type="button" data-key="${key}" data-artist="${escapeHtml(cell.artist)}" data-title="${escapeHtml(cell.title)}" title="${owned ? 'Marked as in your library' : 'Mark as in your library'}">${owned ? '✓' : '+'}</button>`;
  const editBtn = `<button class="mu-art-edit-toggle" type="button" data-key="${key}" data-artist="${escapeHtml(cell.artist)}" data-title="${escapeHtml(cell.title)}" data-el-id="${elId}" title="Fix wrong artwork">✎</button>`;
  if(override && override.image){
    const clickable = !!override.url;
    return `<a class="mu-cell grayed override${owned ? ' owned' : ''}" id="${elId}" href="${clickable ? override.url : 'javascript:void(0)'}" ${clickable ? 'target="_blank" rel="noopener"' : ''} title="${label}" data-q="${q}" data-key="${key}" data-artist="${escapeHtml(cell.artist)}" data-title="${escapeHtml(cell.title)}">
      <img src="${PLACEHOLDER_IMG}" data-src="${override.image}" alt="${label}" loading="lazy">
      ${ownedBtn}${editBtn}
    </a>`;
  }
  return `<div class="mu-cell grayed" id="${elId}" title="${label}" data-q="${q}" data-key="${key}" data-artist="${escapeHtml(cell.artist)}" data-title="${escapeHtml(cell.title)}">
    <div class="fallback">${escapeHtml(cell.title)}</div>
    ${ownedBtn}${editBtn}
  </div>`;
}

export function muTileHtml(cell){
  return `<div class="mu-tile">${muCellHtml(cell)}<div class="mu-cell-caption"><div class="mu-cell-title">${escapeHtml(cell.title)}</div><div class="mu-cell-artist">${escapeHtml(cell.artist)}</div></div></div>`;
}

export function buildMuHtml(cells){
  let html = `<div class="mu-heading">/mu/ Core</div>
    <div class="mu-core-grid" id="muCoreGrid">${cells.core.map(muTileHtml).join('')}</div>
    <div class="mu-heading">Sub-/mu/ Core</div>
    <div class="mu-scroll"><div id="muSections">`;
  Object.keys(cells.sections).forEach(letter => {
    html += `<div class="mu-section-grid"><div class="mu-row-label">${letter}</div>${cells.sections[letter].map(muTileHtml).join('')}</div>`;
  });
  html += `<div class="mu-col-labels"><span></span>${Array.from({length:12}, (_,i) => `<span>${i+1}</span>`).join('')}</div>`;
  html += `</div></div>`;
  html += `<div class="mu-heading">Classics</div>
    <div class="mu-scroll"><div id="muClassicsSections">`;
  Object.keys(cells.classicsSections).forEach(letter => {
    html += `<div class="mu-section-grid"><div class="mu-row-label">${letter}</div>${cells.classicsSections[letter].map(muTileHtml).join('')}</div>`;
  });
  html += `<div class="mu-col-labels"><span></span>${Array.from({length:12}, (_,i) => `<span>${i+1}</span>`).join('')}</div>`;
  html += `</div></div>`;
  return html;
}
