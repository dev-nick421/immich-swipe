// Runtime settings. The Docker image answers /config.js itself (see nginx.conf and
// docker/40-immich-swipe.sh); this static default is used by `npm run dev`, `vite preview`
// and static hosting such as GitHub Pages.
window.__IMMICH_SWIPE__ = { proxy: false }
