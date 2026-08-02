import { REDIRECT_URI, SCOPES, CONFIGURED_CLIENT_ID } from './config.js';

/* ============ PKCE HELPERS ============ */
function base64url(buffer){
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function sha256(plain){
  const data = new TextEncoder().encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}
function randomString(len){
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => ('0'+b.toString(16)).slice(-2)).join('').slice(0,len);
}

export async function startAuth(clientId){
  const verifier = randomString(64);
  const challenge = base64url(await sha256(verifier));
  sessionStorage.setItem('pkce_verifier', verifier);
  localStorage.setItem('spotify_client_id', clientId);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES
  });
  window.location = 'https://accounts.spotify.com/authorize?' + params.toString();
}

export async function exchangeCode(code){
  const verifier = sessionStorage.getItem('pkce_verifier');
  const clientId = CONFIGURED_CLIENT_ID || localStorage.getItem('spotify_client_id');
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body
  });
  if(!res.ok) throw new Error('Token exchange failed');
  const data = await res.json();
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('token_expires', Date.now() + data.expires_in*1000);
}
