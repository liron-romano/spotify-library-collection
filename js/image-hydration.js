/* ============ PERSISTENT ART CACHE (images survive refresh) ============ */
export const PLACEHOLDER_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const ART_CACHE_NAME = 'collection-art-cache-v1';
let artCachePromise = null;
function getArtCache(){
  if(!('caches' in window)) return Promise.resolve(null);
  if(!artCachePromise) artCachePromise = caches.open(ART_CACHE_NAME).catch(() => null);
  return artCachePromise;
}
async function cachedImageSrc(url){
  if(!url) return url;
  try{
    const cache = await getArtCache();
    if(!cache) return url;
    let resp = await cache.match(url);
    if(!resp){
      resp = await fetch(url, { mode: 'cors' });
      if(resp && resp.ok) await cache.put(url, resp.clone());
      else return url;
    }
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }catch(e){
    return url;
  }
}
export function hydrateSingleImage(img){
  const url = img.dataset.src;
  if(!url) return;
  cachedImageSrc(url).then(src => {
    img.src = src;
    img.removeAttribute('data-src');
  }).catch(() => { img.src = url; });
}
export function hydrateImages(root){
  root.querySelectorAll('img[data-src]').forEach(hydrateSingleImage);
}
