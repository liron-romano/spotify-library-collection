# Collection — module map

Split out of the original single-file `index.html` into small, single-purpose ES modules.
Nothing about the app's behavior changed — this is a structural refactor only.

## Running it

Because this now uses native ES modules (`<script type="module">`), it must be served
over HTTP(S), not opened directly as a `file://` URL (browsers block module imports from
`file://` for security reasons). Any static file server works, e.g.:

```
npx serve .
# or
python3 -m http.server
```

Put your `config.json` (with `{ "clientId": "..." }`) next to `index.html`, same as before.

## Layout

```
index.html              Shell only: <link> to css, tiny inline pre-paint theme script, <script type="module" src="js/main.js">
css/
  styles.css             All styles (unchanged from the original <style> block)
js/
  main.js                 Entry point: bootstraps config, OAuth callback, initial fetch, first render
  config.js                Runtime config.json loading + OAuth constants
  theme.js                  Dark/light theme apply + system-preference listener
  auth.js                    Spotify PKCE OAuth flow (start + code exchange)
  spotify-api.js              Spotify Web API calls (saved albums, album search, user id)
  utils.js                     escapeHtml / normalizeStr / stripEdition string helpers
  state.js                      Shared ALL_ALBUMS app state (live ES module binding)
  mu-data.js                     /mu/ chart data: MU_CORE, MU_SECTIONS, MU_CLASSICS_SECTIONS
  mu-render.js                    Matches chart entries to your library + builds /mu/ grid HTML
  image-hydration.js               Placeholder image swap-in via the Cache API
  chart-art.js                      Cover-art lookup for /mu/ (Spotify → iTunes → MusicBrainz) + DOM patching
  persistence.js                     "Owned" marks, manual artwork overrides, chart-art cache, cross-device sync
  color.js                            Cover color analysis for Rainbow sort & Mosaic
  image-cache.js                       Canvas image loading/drawing helpers for the collage generator
  render-login.js                      Login + loading screens
  render-library.js                    Main library/mu view: search, sort, view switching, event wiring
  modals/
    random-modal.js                     "Surprise me" modal
    sync-modal.js                       Sync settings modal
    art-edit-modal.js                   "Fix cover art" modal
    collage-modal.js                    Collage/mosaic generator modal
```

## Why this split

- Each file has one job (data, one API, one piece of persistence, one modal, etc.),
  so changes are easy to locate and touch in isolation.
- `state.js` holds the one piece of truly shared mutable data (the fetched album list)
  as a live-bound export, so it doesn't need to be threaded through every function call.
- `persistence.js` keeps "owned" marks + overrides + cross-device sync together deliberately:
  writes to either store schedule a sync push, and a sync pull writes back into both stores,
  so splitting them further would just create a circular import between two files.
