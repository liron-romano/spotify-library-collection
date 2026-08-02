import { escapeHtml, normalizeStr } from './utils.js';
import { PLACEHOLDER_IMG, hydrateImages } from './image-hydration.js';
import { computeMuCells, buildMuHtml } from './mu-render.js';
import { applyChartArt, hydrateChartArt } from './chart-art.js';
import { isOwned, getOverride, setOwned, getSyncConfig, syncPull, fetchSpotifyUserId } from './persistence.js';
import { ensureColorData } from './color.js';
import { applyTheme } from './theme.js';
import { ALL_ALBUMS } from './state.js';
import { openRandomModal } from './modals/random-modal.js';
import { openSyncModal } from './modals/sync-modal.js';
import { openArtEditModal } from './modals/art-edit-modal.js';
import { openCollageModal } from './modals/collage-modal.js';

/* ============ RENDER: LIBRARY ============ */
export function renderLibrary(){
  const app = document.getElementById('app');
  const darkOn = document.documentElement.getAttribute('data-theme') === 'dark';

  app.innerHTML = `
    <header>
      <div class="wrap" data-wrap>
        <p class="eyebrow">Your Spotify Library</p>
        <h1>Collection</h1>
        <p class="count-line" id="countLine"><strong id="visibleCount">${ALL_ALBUMS.length}</strong> of ${ALL_ALBUMS.length} albums</p>
      </div>
    </header>
    <div class="controls">
      <div class="wrap" data-wrap style="display:flex;flex-direction:column;gap:14px;width:100%;">
        <div class="view-tabs">
          <button class="view-tab active" id="tabLibraryBtn" data-view="library">Library</button>
          <button class="view-tab" id="tabMuBtn" data-view="mu">/mu/</button>
        </div>
        <div class="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A8778" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="searchInput" type="text" placeholder="Search by artist, album, or year…">
        </div>
        <div class="control-row" style="display:flex;gap:14px;flex-wrap:wrap;width:100%;align-items:center;">
          <select id="sortSelect">
            <option value="artist">Sort by Artist</option>
            <option value="album">Sort by Album</option>
            <option value="year">Sort by Year</option>
            <option value="added">Sort by Date Added</option>
            <option value="rainbow">🌈 Rainbow (by color)</option>
          </select>
          <button class="dir-btn" id="dirBtn">↓ Asc</button>
          <button class="toggle-btn" id="themeBtn">${darkOn ? '☀ Light' : '☾ Dark'}</button>
          <button class="toggle-btn" id="gaplessBtn">▦ Gapless</button>
          <button class="toggle-btn" id="fullWidthBtn">⇔ Fill screen</button>
          <button class="toggle-btn" id="collageBtn">🖼 Collage</button>
          <button class="toggle-btn" id="randomBtn">🎲 Surprise me</button>
          <button class="toggle-btn" id="syncBtn">🔗 Sync</button>
        </div>
      </div>
    </div>
    <main>
      <div class="wrap" data-wrap>
        <div id="libraryPanel">
          <div class="grid" id="grid"></div>
          <div class="empty-state" id="emptyState" style="display:none;">No albums match your search.</div>
        </div>
        <div id="muPanel" style="display:none;"></div>
      </div>
    </main>
    <div id="modalRoot"></div>`;

  let sortKey = 'artist';
  let ascending = true;
  let gapless = false;
  let fullWidth = false;

  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const dirBtn = document.getElementById('dirBtn');
  const themeBtn = document.getElementById('themeBtn');
  const gaplessBtn = document.getElementById('gaplessBtn');
  const fullWidthBtn = document.getElementById('fullWidthBtn');
  const collageBtn = document.getElementById('collageBtn');
  const randomBtn = document.getElementById('randomBtn');
  const syncBtn = document.getElementById('syncBtn');
  const grid = document.getElementById('grid');

  const muPanel = document.getElementById('muPanel');
  const libraryPanel = document.getElementById('libraryPanel');
  const tabLibraryBtn = document.getElementById('tabLibraryBtn');
  const tabMuBtn = document.getElementById('tabMuBtn');
  const countLine = document.getElementById('countLine');
  let activeView = 'library';

  const muCells = computeMuCells(ALL_ALBUMS);
  const muFlat = [...muCells.core, ...Object.values(muCells.sections).flat(), ...Object.values(muCells.classicsSections).flat()];
  muPanel.innerHTML = buildMuHtml(muCells);
  hydrateImages(muPanel);
  hydrateChartArt(muFlat);

  // Toggling "in library" (owned), or opening the artwork-fix modal, on a /mu/ cell.
  const isTouch = window.matchMedia && window.matchMedia('(hover: none)').matches;
  let touchActiveCell = null;
  muPanel.addEventListener('click', (e) => {
    const ownedBtn = e.target.closest('.mu-owned-toggle');
    if(ownedBtn){
      e.preventDefault();
      e.stopPropagation();
      const key = ownedBtn.dataset.key, artist = ownedBtn.dataset.artist, title = ownedBtn.dataset.title;
      const nowOwned = !ownedBtn.classList.contains('active');
      setOwnedAndRefreshButton(ownedBtn, key, artist, title, nowOwned);
      updateCountLine();
      return;
    }
    const editBtn = e.target.closest('.mu-art-edit-toggle');
    if(editBtn){
      e.preventDefault();
      e.stopPropagation();
      openArtEditModal(editBtn.dataset.key, editBtn.dataset.artist, editBtn.dataset.title, editBtn.dataset.elId, updateCountLine);
      return;
    }
    // Tap-to-reveal: only cells with owned/edit buttons (the "grayed" — i.e. not a
    // confirmed Spotify match) ones have anything to reveal. First tap shows them
    // (like a mouse hover) and swallows the tap so it doesn't also navigate; the
    // cell is already "revealed" on a second tap, so that one goes through normally.
    if(isTouch){
      const cell = e.target.closest('.mu-cell.grayed');
      if(cell && !cell.classList.contains('touch-active')){
        e.preventDefault();
        if(touchActiveCell && touchActiveCell !== cell) touchActiveCell.classList.remove('touch-active');
        cell.classList.add('touch-active');
        touchActiveCell = cell;
      }
    }
  });
  if(isTouch){
    // Tapping anywhere outside the currently revealed cell dismisses it.
    document.addEventListener('click', (e) => {
      if(touchActiveCell && !touchActiveCell.contains(e.target)){
        touchActiveCell.classList.remove('touch-active');
        touchActiveCell = null;
      }
    });
  }

  function setOwnedAndRefreshButton(ownedBtn, key, artist, title, nowOwned){
    setOwned(key, artist, title, nowOwned);
    ownedBtn.classList.toggle('active', nowOwned);
    ownedBtn.textContent = nowOwned ? '✓' : '+';
    ownedBtn.title = nowOwned ? 'Marked as in your library' : 'Mark as in your library';
    const cell = ownedBtn.closest('.mu-cell');
    if(cell) cell.classList.toggle('owned', nowOwned);
  }

  // Pull any cross-device "owned" marks and artwork fixes (if sync is configured) and refresh once they arrive.
  (async () => {
    const token = localStorage.getItem('access_token');
    if(token) await fetchSpotifyUserId(token);
    if(getSyncConfig()){
      const merged = await syncPull();
      if(merged){
        muPanel.querySelectorAll('.mu-cell[data-key]').forEach(cell => {
          const key = cell.dataset.key;
          const override = getOverride(key);
          if(override && override.image){
            const label = escapeHtml(`${cell.dataset.title} — ${cell.dataset.artist}`);
            const q = escapeHtml((cell.dataset.artist + ' ' + cell.dataset.title).toLowerCase());
            applyChartArt(cell.id, label, q, override, key, cell.dataset.artist, cell.dataset.title);
            return;
          }
          const owned = isOwned(key);
          cell.classList.toggle('owned', owned);
          const btn = cell.querySelector('.mu-owned-toggle');
          if(btn){
            btn.classList.toggle('active', owned);
            btn.textContent = owned ? '✓' : '+';
            btn.title = owned ? 'Marked as in your library' : 'Mark as in your library';
          }
        });
        updateCountLine();
      }
    }
  })();

  function updateCountLine(){
    if(activeView === 'library'){
      countLine.innerHTML = `<strong id="visibleCount">${currentList.length}</strong> of ${ALL_ALBUMS.length} albums`;
    } else {
      const matched = muFlat.filter(c => c.match).length;
      const ownedExtra = muFlat.filter(c => !c.match && isOwned(normalizeStr(c.artist) + '|' + normalizeStr(c.title))).length;
      countLine.innerHTML = `<strong>${matched}</strong> of ${muFlat.length} chart albums in your library`
        + (ownedExtra ? ` · <strong>${ownedExtra}</strong> more marked owned` : '');
    }
  }

  function filterMuBySearch(){
    const q = searchInput.value.trim().toLowerCase();
    muPanel.querySelectorAll('.mu-cell').forEach(el => {
      const hay = el.dataset.q || '';
      const shouldDim = !(!q || hay.includes(q));
      el.classList.toggle('dimmed', shouldDim);
      const tile = el.closest('.mu-tile');
      if(tile) tile.classList.toggle('dimmed', shouldDim);
    });
  }

  function switchView(view){
    activeView = view;
    tabLibraryBtn.classList.toggle('active', view === 'library');
    tabMuBtn.classList.toggle('active', view === 'mu');
    libraryPanel.style.display = view === 'library' ? '' : 'none';
    muPanel.style.display = view === 'mu' ? '' : 'none';
    sortSelect.disabled = view === 'mu';
    dirBtn.disabled = view === 'mu';
    sortSelect.style.opacity = dirBtn.style.opacity = view === 'mu' ? '.45' : '';
    updateCountLine();
    filterMuBySearch();
  }
  tabLibraryBtn.addEventListener('click', () => switchView('library'));
  tabMuBtn.addEventListener('click', () => switchView('mu'));

  function getMuMatchedPool(){
    const q = searchInput.value.trim().toLowerCase();
    return muFlat
      .filter(c => c.match && (!q || (c.artist + ' ' + c.title).toLowerCase().includes(q)))
      .map(c => c.match);
  }

  let currentList = ALL_ALBUMS.slice();

  async function apply(){
    const q = searchInput.value.trim().toLowerCase();
    let list = ALL_ALBUMS.filter(a =>
      !q || a.artist.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.year.includes(q)
    );

    if(sortKey === 'rainbow'){
      sortSelect.disabled = true;
      renderLoadingInline('Analyzing cover colors…');
      await ensureColorData(list);
      sortSelect.disabled = false;
      list.sort((a,b) => (ascending ? 1 : -1) * ((a.hue||0) - (b.hue||0)));
    } else {
      list.sort((a,b) => {
        let av, bv;
        if(sortKey === 'artist'){ av=a.artist.toLowerCase(); bv=b.artist.toLowerCase(); }
        else if(sortKey === 'album'){ av=a.name.toLowerCase(); bv=b.name.toLowerCase(); }
        else if(sortKey === 'year'){ av=a.year; bv=b.year; }
        else { av=a.added_at; bv=b.added_at; }
        if(av < bv) return ascending ? -1 : 1;
        if(av > bv) return ascending ? 1 : -1;
        return 0;
      });
    }
    currentList = list;
    renderGrid(list);
    updateCountLine();
    filterMuBySearch();
  }

  function renderLoadingInline(msg){
    grid.style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('emptyState').textContent = msg;
  }

  function renderGrid(list){
    const empty = document.getElementById('emptyState');
    if(list.length === 0){
      grid.style.display = 'none';
      empty.style.display = 'block';
      empty.textContent = 'No albums match your search.';
      return;
    }
    grid.style.display = 'grid';
    empty.style.display = 'none';
    grid.className = 'grid' + (gapless ? ' gapless' : '');
    grid.style.gridTemplateColumns = '';
    grid.innerHTML = list.map(a => `
      <a class="album" href="${a.url}" target="_blank" rel="noopener" title="${a.name} — ${a.artist} (${a.year})">
        <div class="cover-wrap"><img src="${PLACEHOLDER_IMG}" data-src="${a.image}" alt="${a.name}" loading="lazy"></div>
        <div class="meta">
          <p class="title">${a.name}</p>
          <p class="artist">${a.artist}</p>
          <p class="year">${a.year}</p>
        </div>
      </a>`).join('');
    hydrateImages(grid);
  }

  searchInput.addEventListener('input', apply);
  sortSelect.addEventListener('change', e => { sortKey = e.target.value; apply(); });
  dirBtn.addEventListener('click', () => {
    ascending = !ascending;
    dirBtn.textContent = ascending ? '↓ Asc' : '↑ Desc';
    apply();
  });
  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
    themeBtn.textContent = next === 'dark' ? '☀ Light' : '☾ Dark';
  });
  gaplessBtn.addEventListener('click', () => {
    gapless = !gapless;
    gaplessBtn.classList.toggle('active', gapless);
    grid.className = 'grid' + (gapless ? ' gapless' : '');
    muPanel.querySelectorAll('.mu-core-grid, .mu-section-grid').forEach(el => el.classList.toggle('gapless', gapless));
  });
  fullWidthBtn.addEventListener('click', () => {
    fullWidth = !fullWidth;
    fullWidthBtn.classList.toggle('active', fullWidth);
    document.querySelectorAll('[data-wrap]').forEach(el => el.classList.toggle('full-width', fullWidth));
  });
  collageBtn.addEventListener('click', openCollageModal);
  syncBtn.addEventListener('click', openSyncModal);
  randomBtn.addEventListener('click', () => {
    if(activeView === 'mu') openRandomModal(getMuMatchedPool());
    else openRandomModal(currentList.length ? currentList : ALL_ALBUMS);
  });

  updateCountLine();
  apply();
}
