/* ============ CONFIG ============ */
export const REDIRECT_URI = window.location.origin + window.location.pathname;
export const SCOPES = "user-library-read";

/* ============ RUNTIME CONFIG ============
   Looks for a sibling config.json (same folder as this page) containing
   { "clientId": "..." }. Client IDs aren't secret — Spotify's PKCE flow exists
   specifically so no secret ever needs to live in client-side code — so this
   is safe to commit to a public repo. If the file is missing or invalid, the
   app just falls back to the manual "enter your Client ID" screen. */
export let CONFIGURED_CLIENT_ID = null;

export async function loadRuntimeConfig(){
  try{
    const res = await fetch('config.json', { cache: 'no-store' });
    if(!res.ok) return;
    const data = await res.json();
    if(data && typeof data.clientId === 'string' && data.clientId.trim()){
      CONFIGURED_CLIENT_ID = data.clientId.trim();
    }
  }catch(e){ /* no config.json present, or it's invalid — fine, fall back */ }
}
