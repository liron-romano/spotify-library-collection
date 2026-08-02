import { escapeHtml } from '../utils.js';
import { fetchSpotifyUserId } from '../spotify-api.js';
import { getSyncConfig, syncPull, syncPushAll } from '../persistence.js';

/* ============ SYNC SETTINGS MODAL ============ */
export function openSyncModal(){
  const root = document.getElementById('modalRoot');
  const cfg = getSyncConfig();
  const savedUrl = localStorage.getItem('sync_url') || '';
  const savedToken = localStorage.getItem('sync_token') || '';
  root.innerHTML = `
    <div class="collage-backdrop" id="syncBackdrop">
      <div class="collage-card">
        <button class="collage-close" id="syncClose">✕</button>
        <h2>Sync marks & artwork fixes</h2>
        <p class="sub">Carry your /mu/ "in library" marks and any artwork corrections across devices by pointing this page at a small hosted endpoint. Leave blank to keep them on this device only.</p>
        <div class="sync-status ${cfg ? 'ok' : ''}" id="syncStatusLine">${cfg ? `Connected as Spotify user <strong>${cfg.user}</strong>` : 'Not connected — marks and fixes are stored on this device only.'}</div>
        <div class="row-field">
          <label>Sync URL</label>
          <input type="text" id="syncUrlInput" placeholder="https://your-worker.example.workers.dev" value="${escapeHtml(savedUrl)}">
        </div>
        <div class="row-field">
          <label>Sync Key</label>
          <input type="text" id="syncTokenInput" placeholder="shared secret you set on the endpoint" value="${escapeHtml(savedToken)}">
        </div>
        <button class="generate-btn" id="syncSaveBtn">Save & sync now</button>
        <button class="sync-clear-btn" id="syncClearBtn">Clear sync settings</button>
        <div class="collage-status" id="syncModalStatus"></div>
      </div>
    </div>`;
  document.getElementById('syncClose').onclick = () => root.innerHTML = '';
  document.getElementById('syncBackdrop').addEventListener('click', (e) => {
    if(e.target.id === 'syncBackdrop') root.innerHTML = '';
  });
  const statusEl = document.getElementById('syncModalStatus');
  document.getElementById('syncSaveBtn').onclick = async () => {
    const url = document.getElementById('syncUrlInput').value.trim();
    const token = document.getElementById('syncTokenInput').value.trim();
    if(!url || !token){ statusEl.textContent = 'Enter both a URL and a key.'; return; }
    localStorage.setItem('sync_url', url);
    localStorage.setItem('sync_token', token);
    statusEl.textContent = 'Connecting…';
    const accessToken = localStorage.getItem('access_token');
    const userId = await fetchSpotifyUserId(accessToken);
    if(!userId){ statusEl.textContent = 'Could not identify your Spotify account — try reconnecting.'; return; }
    const merged = await syncPull();
    if(merged === null){ statusEl.textContent = 'Could not reach that endpoint. Check the URL/key and that it allows CORS from this page.'; return; }
    await syncPushAll();
    statusEl.textContent = 'Synced ✓ — reloading to refresh marks…';
    setTimeout(() => window.location.reload(), 700);
  };
  document.getElementById('syncClearBtn').onclick = () => {
    localStorage.removeItem('sync_url');
    localStorage.removeItem('sync_token');
    statusEl.textContent = 'Sync settings cleared. Marks will stay on this device only.';
  };
}
