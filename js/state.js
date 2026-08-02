/* ============ SHARED APP STATE ============
   ES module `let` exports are live bindings — every module that imports ALL_ALBUMS
   sees updates made here via setAllAlbums(), without needing to pass the array around. */
export let ALL_ALBUMS = [];

export function setAllAlbums(albums){
  ALL_ALBUMS = albums;
}
