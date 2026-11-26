/* Spendwise service worker — offline app shell.
   Bump CACHE_VERSION whenever app files change so installed clients refresh. */
const CACHE_VERSION = "spendwise-v1";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./css/auth.css",
  "./css/base.css",
  "./css/components.css",
  "./css/responsive.css",
  "./css/shell.css",
  "./css/views.css",
  "./js/api.js",
  "./js/auth.js",
  "./js/charts.js",
  "./js/config.js",
  "./js/data.js",
  "./js/dialogs.js",
  "./js/main.js",
  "./js/state.js",
  "./js/theme.js",
  "./js/utils.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Backend API and CDNs (Chart.js, fonts, icon fonts) always go straight to
  // the network — never cached here, so login/data behaviour stays untouched.
  if (url.origin !== self.location.origin) return;

  // Page navigations: network first so updates arrive, cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_VERSION)
            .then((cache) => cache.put("./index.html", copy))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
