/* Shawarma Queen service worker — offline support without stale pages.
   Strategy: network-first for page loads (so updates always show),
   cache-first for static assets. Bump CACHE on deploys that change
   core assets. */

var CACHE = "sq-v10";
var CORE = [
  "./",
  "index.html",
  "css/styles.css",
  "js/main.js",
  "js/vendor/gsap.min.js",
  "js/vendor/ScrollTrigger.min.js",
  "manifest.webmanifest",
  "fonts/bricolage-grotesque-latin-600-normal.woff2",
  "fonts/bricolage-grotesque-latin-700-normal.woff2",
  "fonts/bricolage-grotesque-latin-800-normal.woff2",
  "fonts/hanken-grotesk-latin-300-normal.woff2",
  "fonts/hanken-grotesk-latin-400-normal.woff2",
  "fonts/hanken-grotesk-latin-500-normal.woff2",
  "fonts/hanken-grotesk-latin-600-normal.woff2",
  "fonts/hanken-grotesk-latin-700-normal.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  var networkFirst = e.request.mode === "navigate" ||
    /\.(?:html|css|js)$|manifest\.webmanifest$/.test(url.pathname) ||
    url.pathname.endsWith("/");
  if (networkFirst) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return caches.match(e.request); })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
    })
  );
});
