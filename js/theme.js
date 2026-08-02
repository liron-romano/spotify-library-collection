/* ============ THEME ============ */
export function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
}

if(window.matchMedia){
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only follow the system automatically if the user hasn't manually overridden it.
    if(!localStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light');
  });
}
