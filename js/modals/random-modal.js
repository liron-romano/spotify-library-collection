import { PLACEHOLDER_IMG, hydrateImages } from '../image-hydration.js';

/* ============ RANDOM PICK MODAL ============ */
export function closeModal(){
  document.getElementById('modalRoot').innerHTML = '';
}

export function openRandomModal(pool){
  if(pool.length === 0){ alert('No matching albums to pick from.'); return; }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal-card">
        <button class="modal-close" id="modalClose">✕</button>
        <img src="${PLACEHOLDER_IMG}" data-src="${pick.image}" alt="${pick.name}">
        <p class="title">${pick.name}</p>
        <p class="artist">${pick.artist}</p>
        <p class="year">${pick.year}</p>
        <div class="modal-actions">
          <button class="again-btn" id="againBtn">Pick again</button>
          <a class="open-link" href="${pick.url}" target="_blank" rel="noopener">Open in Spotify</a>
        </div>
      </div>
    </div>`;
  hydrateImages(root);
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if(e.target.id === 'modalBackdrop') closeModal();
  });
  document.getElementById('againBtn').onclick = () => openRandomModal(pool);
}
