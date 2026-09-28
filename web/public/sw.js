const CACHE = "diet-shell-v5";
const ASSETS = ["/diet/", "/diet/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    // ponytail: cache-first so a pure-local app opens instantly offline;
    // network refresh runs in the background and updates the cache for next launch.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request).then((response) => {
          // ponytail: clone immediately, before any await — once this .then
          // returns, the browser may start reading the response body and a
          // later clone() throws "body already used".
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {})
          return response;
        }).catch(() => caches.match("/diet/"));
        return cached || network;
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {})
      }
      return response;
    }))
  );
});
