/* ============ COLOR ANALYSIS (for Rainbow sort & Mosaic) ============ */
export function analyzeCoverColor(url){
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try{
        const size = 8;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r=0,g=0,b=0,n=0;
        for(let i=0;i<data.length;i+=4){
          r+=data[i]; g+=data[i+1]; b+=data[i+2]; n++;
        }
        r/=n; g/=n; b/=n;
        const [h] = rgbToHsl(r,g,b);
        resolve({hue:h, r, g, b});
      }catch(e){ resolve({hue:0, r:128, g:128, b:128}); }
    };
    img.onerror = () => resolve({hue:0, r:128, g:128, b:128});
    img.src = url;
  });
}

export function rgbToHsl(r,g,b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0, s=0, l=(max+min)/2;
  if(max !== min){
    const d = max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d + (g<b?6:0); break;
      case g: h=(b-r)/d + 2; break;
      case b: h=(r-g)/d + 4; break;
    }
    h *= 60;
  }
  return [h, s, l];
}

export async function ensureColorData(albums){
  const pending = albums.filter(a => a.hue === undefined && a.image);
  const CONCURRENCY = 8;
  let idx = 0;
  async function worker(){
    while(idx < pending.length){
      const a = pending[idx++];
      const c = await analyzeCoverColor(a.image);
      a.hue = c.hue; a.r = c.r; a.g = c.g; a.b = c.b;
    }
  }
  await Promise.all(Array.from({length: Math.min(CONCURRENCY, pending.length)}, worker));
}
