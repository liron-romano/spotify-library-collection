import { ALL_ALBUMS } from '../state.js';
import { loadImage, drawCover } from '../image-cache.js';
import { ensureColorData } from '../color.js';

/* ============ COLLAGE / MOSAIC GENERATOR MODAL ============ */
export function openCollageModal(){
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="collage-backdrop" id="collageBackdrop">
      <div class="collage-card">
        <button class="collage-close" id="collageClose">✕</button>
        <h2>Collage Generator</h2>
        <p class="sub">Build a poster from your library's album covers.</p>
        <div class="tab-row">
          <button class="tab-btn active" data-tab="grid">Grid</button>
          <button class="tab-btn" data-tab="mosaic">Mosaic</button>
        </div>

        <div class="panel active" data-panel="grid">
          <div class="row-field">
            <label>Grid size — <span id="gridSizeVal">8</span> × <span id="gridSizeVal2">8</span></label>
            <input type="range" id="gridSizeSlider" min="3" max="15" value="8">
          </div>
          <button class="generate-btn" id="genGridBtn">Generate grid collage</button>
        </div>

        <div class="panel" data-panel="mosaic">
          <div class="row-field">
            <label>Source image</label>
            <input type="file" id="mosaicFile" accept="image/*">
          </div>
          <div class="row-field">
            <label>Detail — <span id="mosaicDetailVal">40</span> tiles wide</label>
            <input type="range" id="mosaicDetailSlider" min="15" max="70" value="40">
          </div>
          <button class="generate-btn" id="genMosaicBtn" disabled>Upload an image first</button>
        </div>

        <div class="collage-status" id="collageStatus"></div>
        <div class="collage-output" id="collageOutput"></div>
      </div>
    </div>`;

  document.getElementById('collageClose').onclick = () => root.innerHTML = '';
  document.getElementById('collageBackdrop').addEventListener('click', (e) => {
    if(e.target.id === 'collageBackdrop') root.innerHTML = '';
  });

  root.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      root.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      root.querySelector(`.panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
      document.getElementById('collageOutput').innerHTML = '';
      document.getElementById('collageStatus').textContent = '';
    });
  });

  const statusEl = document.getElementById('collageStatus');
  const outputEl = document.getElementById('collageOutput');

  function showOutput(canvas, filename){
    outputEl.innerHTML = '';
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    outputEl.appendChild(img);
    outputEl.appendChild(document.createElement('br'));
    const dl = document.createElement('a');
    dl.className = 'dl-btn';
    dl.textContent = 'Download PNG';
    dl.href = img.src;
    dl.download = filename;
    outputEl.appendChild(dl);
  }

  /* ---- Grid mode ---- */
  const gridSizeSlider = document.getElementById('gridSizeSlider');
  gridSizeSlider.addEventListener('input', () => {
    document.getElementById('gridSizeVal').textContent = gridSizeSlider.value;
    document.getElementById('gridSizeVal2').textContent = gridSizeSlider.value;
  });
  document.getElementById('genGridBtn').addEventListener('click', async (e) => {
    if(ALL_ALBUMS.length === 0){ statusEl.textContent = 'No albums to work with.'; return; }
    const btn = e.target; btn.disabled = true;
    const n = Number(gridSizeSlider.value);
    const tile = 90;
    const size = n * tile;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    outputEl.innerHTML = '';
    const pool = ALL_ALBUMS.filter(a => a.image);
    const picks = Array.from({length: n*n}, () => pool[Math.floor(Math.random() * pool.length)]);
    let loaded = 0;
    await Promise.all(picks.map(async (a, i) => {
      try{
        const img = await loadImage(a.image);
        drawCover(ctx, img, (i % n) * tile, Math.floor(i / n) * tile, tile);
      }catch(err){}
      loaded++;
      statusEl.textContent = `Loading covers… ${loaded}/${picks.length}`;
    }));
    statusEl.textContent = '';
    btn.disabled = false;
    showOutput(canvas, 'album-grid-collage.png');
  });

  /* ---- Mosaic mode ---- */
  let mosaicImg = null;
  const mosaicFile = document.getElementById('mosaicFile');
  const genMosaicBtn = document.getElementById('genMosaicBtn');
  const mosaicDetailSlider = document.getElementById('mosaicDetailSlider');
  mosaicDetailSlider.addEventListener('input', () => {
    document.getElementById('mosaicDetailVal').textContent = mosaicDetailSlider.value;
  });
  mosaicFile.addEventListener('change', () => {
    const file = mosaicFile.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        mosaicImg = img;
        genMosaicBtn.disabled = false;
        genMosaicBtn.textContent = 'Generate mosaic';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  genMosaicBtn.addEventListener('click', async (e) => {
    if(!mosaicImg || ALL_ALBUMS.length === 0) return;
    const btn = e.target; btn.disabled = true;
    const cols = Number(mosaicDetailSlider.value);
    const rows = Math.max(1, Math.round(cols * (mosaicImg.height / mosaicImg.width)));

    statusEl.textContent = 'Analyzing your library\u2019s colors…';
    outputEl.innerHTML = '';
    const withImages = ALL_ALBUMS.filter(a => a.image);
    await ensureColorData(withImages);

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = cols; sampleCanvas.height = rows;
    const sctx = sampleCanvas.getContext('2d');
    sctx.drawImage(mosaicImg, 0, 0, cols, rows);
    const sampleData = sctx.getImageData(0, 0, cols, rows).data;

    const pool = withImages.filter(a => a.r !== undefined);
    if(pool.length === 0){ statusEl.textContent = 'Could not analyze library colors.'; btn.disabled = false; return; }

    const tile = 24;
    const canvas = document.createElement('canvas');
    canvas.width = cols * tile; canvas.height = rows * tile;
    const ctx = canvas.getContext('2d');

    let done = 0;
    const total = cols * rows;
    for(let row = 0; row < rows; row++){
      for(let col = 0; col < cols; col++){
        const idx = (row*cols + col) * 4;
        const tr = sampleData[idx], tg = sampleData[idx+1], tb = sampleData[idx+2];
        let best = pool[0], bestDist = Infinity;
        for(const a of pool){
          const d = (a.r-tr)**2 + (a.g-tg)**2 + (a.b-tb)**2;
          if(d < bestDist){ bestDist = d; best = a; }
        }
        try{
          const img = await loadImage(best.image);
          drawCover(ctx, img, col*tile, row*tile, tile + 1);
        }catch(err){}
        done++;
        if(done % 25 === 0) statusEl.textContent = `Building mosaic… ${done}/${total}`;
      }
    }
    statusEl.textContent = '';
    btn.disabled = false;
    showOutput(canvas, 'album-mosaic.png');
  });
}
