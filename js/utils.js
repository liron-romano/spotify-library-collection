/* ============ STRING / HTML UTILITIES ============ */
export function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

export function normalizeStr(s){
  return (s||'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,' and ')
    .replace(/[’']/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}

export function stripEdition(s){
  return (s||'').replace(/\s*[\(\[][^)\]]*(deluxe|remaster|edition|version|bonus|anniversary|mono|stereo|expanded)[^)\]]*[\)\]]/gi, '');
}
