/* ============ IMAGE CACHE (for Collage) ============ */
const IMG_CACHE = new Map();

export function loadImage(url){
  if(IMG_CACHE.has(url)) return IMG_CACHE.get(url);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
  IMG_CACHE.set(url, p);
  return p;
}

export function drawCover(ctx, img, x, y, size){
  const s = Math.min(img.width, img.height);
  const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
  ctx.drawImage(img, sx, sy, s, s, x, y, size, size);
}
