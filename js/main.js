import { loadRuntimeConfig } from './config.js';
import { exchangeCode } from './auth.js';
import { fetchAllAlbums } from './spotify-api.js';
import { renderLogin, renderLoading } from './render-login.js';
import { renderLibrary } from './render-library.js';
import { setAllAlbums } from './state.js';

/* ============ BOOTSTRAP ============ */
async function init(){
  await loadRuntimeConfig();

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const authError = urlParams.get('error');

  if(authError){
    renderLogin('Spotify authorization was denied or failed. Please try again.');
    return;
  }

  if(code){
    renderLoading('Connecting to Spotify…');
    try{
      await exchangeCode(code);
      window.history.replaceState({}, document.title, window.location.pathname);
    }catch(e){
      renderLogin('Could not complete sign-in. Double-check your Client ID and Redirect URI, then try again.');
      return;
    }
  }

  const token = localStorage.getItem('access_token');
  const expires = localStorage.getItem('token_expires');

  if(!token || Date.now() > Number(expires)){
    renderLogin();
    return;
  }

  renderLoading('Loading your albums…');
  try{
    setAllAlbums(await fetchAllAlbums(token));
    renderLibrary();
  }catch(e){
    renderLogin('Session expired or request failed. Please reconnect.');
  }
}

init();
