// Minimal service worker — enables "Install App" in Chrome.
// We deliberately don't cache app data, so the app always shows
// live data from Supabase rather than a stale offline copy.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass-through: always go to the network for fresh data.
  event.respondWith(fetch(event.request));
});
