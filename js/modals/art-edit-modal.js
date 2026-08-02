import { escapeHtml } from '../utils.js';
import { PLACEHOLDER_IMG } from '../image-hydration.js';
import { loadChartArtCache, saveChartArtCache, getOverride, setOverride, clearOverride } from '../persistence.js';
import { applyChartArt, findChartArt, tryNextArtSource } from '../chart-art.js';

/* ============ "FIX WRONG ARTWORK" MODAL ============
   onApplied is called after an image is saved/reset so the caller (render-library)
   can refresh things like the count line. */
export function openArtEditModal(key, artist, title, elId, onApplied){
  const root = document.getElementById('modalRoot');
  const cache = loadChartArtCache();
  const override = getOverride(key);
  const current = override || cache[key] || null;
  let currentSource = current ? current.source : null;
  root.innerHTML = `
    <div class="collage-backdrop" id="artEditBackdrop">
      <div class="collage-card">
        <button class="collage-close" id="artEditClose">✕</button>
        <h2>Fix cover art</h2>
        <p class="sub">${escapeHtml(title)} — ${escapeHtml(artist)}</p>
        <div style="display:flex;justify-content:center;margin-bottom:18px;">
          <img id="artEditPreview" src="${current && current.image ? current.image : PLACEHOLDER_IMG}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;background:var(--line);box-shadow:0 6px 18px -8px var(--shadow);">
        </div>
        <div class="row-field">
          <label>Image URL</label>
          <input type="text" id="artEditUrlInput" placeholder="https://..." value="${current && current.image ? escapeHtml(current.image) : ''}">
        </div>
        <button class="generate-btn" id="artEditSaveBtn">Save this image</button>
        <button class="sync-clear-btn" id="artEditNextBtn">Try next source</button>
        ${override ? `<button class="sync-clear-btn" id="artEditResetBtn">Reset to automatic</button>` : ''}
        <div class="collage-status" id="artEditStatus"></div>
      </div>
    </div>`;
  document.getElementById('artEditClose').onclick = () => root.innerHTML = '';
  document.getElementById('artEditBackdrop').addEventListener('click', (e) => {
    if(e.target.id === 'artEditBackdrop') root.innerHTML = '';
  });
  const urlInput = document.getElementById('artEditUrlInput');
  const preview = document.getElementById('artEditPreview');
  const statusEl = document.getElementById('artEditStatus');
  urlInput.addEventListener('input', () => {
    preview.src = urlInput.value.trim() || PLACEHOLDER_IMG;
  });

  function applyAndClose(result){
    const label = escapeHtml(`${title} — ${artist}`);
    const q = escapeHtml((artist + ' ' + title).toLowerCase());
    applyChartArt(elId, label, q, result, key, artist, title);
    root.innerHTML = '';
    if(onApplied) onApplied();
  }

  document.getElementById('artEditSaveBtn').onclick = () => {
    const url = urlInput.value.trim();
    if(!url){ statusEl.textContent = 'Paste an image URL first.'; return; }
    const saved = setOverride(key, artist, title, url, '');
    applyAndClose(saved);
  };
  document.getElementById('artEditNextBtn').onclick = async () => {
    const btn = document.getElementById('artEditNextBtn');
    btn.disabled = true;
    statusEl.textContent = 'Checking other sources…';
    const token = localStorage.getItem('access_token');
    const result = await tryNextArtSource(token, artist, title, currentSource);
    btn.disabled = false;
    if(!result){ statusEl.textContent = 'No more alternate sources found — try pasting a URL instead.'; return; }
    preview.src = result.image;
    urlInput.value = result.image;
    currentSource = result.source;
    statusEl.textContent = `Found via ${result.source}. Click "Save this image" to keep it, or try again.`;
  };
  const resetBtn = document.getElementById('artEditResetBtn');
  if(resetBtn){
    resetBtn.onclick = async () => {
      resetBtn.disabled = true;
      clearOverride(key);
      const c = loadChartArtCache();
      delete c[key];
      saveChartArtCache(c);
      statusEl.textContent = 'Looking up automatically…';
      const token = localStorage.getItem('access_token');
      const result = await findChartArt(token, artist, title);
      const c2 = loadChartArtCache();
      c2[key] = result;
      saveChartArtCache(c2);
      applyAndClose(result);
    };
  }
}
