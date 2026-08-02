import { REDIRECT_URI, CONFIGURED_CLIENT_ID } from './config.js';
import { startAuth } from './auth.js';

/* ============ RENDER: LOGIN ============ */
export function renderLogin(errorMsg){
  const app = document.getElementById('app');
  const savedClientId = localStorage.getItem('spotify_client_id');
  const usingConfig = !!CONFIGURED_CLIENT_ID;

  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <h1>Your Collection</h1>
        <p>Connect your Spotify account to view your saved albums as a browsable grid.</p>
        ${errorMsg ? `<div class="error-msg">${errorMsg}</div>` : ''}
        ${usingConfig || savedClientId ? '' : `
        <div class="field">
          <label>Client ID</label>
          <input id="clientId" type="text" placeholder="from your Spotify Developer Dashboard" autocomplete="off">
        </div>`}
        <button class="connect-btn" id="connectBtn">Connect to Spotify</button>
        ${usingConfig ? '' : savedClientId ? `<div class="hint" style="text-align:center;"><a href="#" id="resetIdLink">Use a different Client ID</a></div>` : `
        <div class="hint">
          In your <a href="https://developer.spotify.com/dashboard" target="_blank">Spotify Developer Dashboard</a>,
          add this exact Redirect URI to your app's settings:<br>
          <code>${REDIRECT_URI}</code><br><br>
          No client secret needed — this uses the secure PKCE flow, so nothing sensitive is ever exposed in the browser.
          You'll only need to enter this once — it's remembered on this device from here on.
        </div>`}
      </div>
    </div>`;

  document.getElementById('connectBtn').onclick = () => {
    const id = CONFIGURED_CLIENT_ID || savedClientId || document.getElementById('clientId').value.trim();
    if(!id){ alert('Enter your Client ID first.'); return; }
    startAuth(id);
  };

  const resetLink = document.getElementById('resetIdLink');
  if(resetLink){
    resetLink.onclick = (e) => {
      e.preventDefault();
      localStorage.removeItem('spotify_client_id');
      renderLogin();
    };
  }
}

export function renderLoading(msg){
  document.getElementById('app').innerHTML = `<div class="loading">${msg}</div>`;
}
