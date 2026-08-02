/* ============ DATA FETCH ============ */
export async function fetchAllAlbums(token){
  let albums = [];
  let url = 'https://api.spotify.com/v1/me/albums?limit=50';
  while(url){
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token }});
    if(!res.ok) throw new Error('Failed to fetch albums ('+res.status+')');
    const data = await res.json();
    albums = albums.concat(data.items.map(it => ({
      id: it.album.id,
      name: it.album.name,
      artist: it.album.artists.map(a=>a.name).join(', '),
      year: (it.album.release_date||'').slice(0,4),
      image: (it.album.images[1] || it.album.images[0] || {}).url || '',
      added_at: it.added_at,
      url: it.album.external_urls.spotify
    })));
    url = data.next;
  }
  return albums;
}

/* Used by the chart-art lookup to find cover art + link for /mu/ albums not in the library. */
export async function searchSpotifyAlbum(token, artist, title){
  const q = encodeURIComponent(`${artist} ${title}`);
  const res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=album&limit=1`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if(!res.ok) return null;
  const data = await res.json();
  const item = data.albums && data.albums.items && data.albums.items[0];
  if(!item) return null;
  return {
    image: (item.images[1] || item.images[0] || {}).url || '',
    url: item.external_urls.spotify,
    source: 'spotify'
  };
}

export async function fetchSpotifyUserId(token){
  const cached = localStorage.getItem('spotify_user_id');
  if(cached) return cached;
  try{
    const res = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: 'Bearer ' + token } });
    if(!res.ok) return null;
    const data = await res.json();
    if(data.id){ localStorage.setItem('spotify_user_id', data.id); return data.id; }
  }catch(e){}
  return null;
}
