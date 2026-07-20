/* Los Güeros service worker — offline shell + asset cache.
   Bump CACHE on every deploy that changes core assets. */

var CACHE = "lg-v1";
var CORE = [
  "./",
  "index.html",
  "css/styles.css",
  "js/main.js",
  "js/vendor/gsap.min.js",
  "js/vendor/ScrollTrigger.min.js",
  "manifest.webmanifest",
  "media/hero-poster.jpg",
  "fonts/cormorant-garamond-latin-400-normal.woff2",
  "fonts/cormorant-garamond-latin-500-normal.woff2",
  "fonts/cormorant-garamond-latin-600-normal.woff2",
  "fonts/cormorant-garamond-latin-400-italic.woff2",
  "fonts/cormorant-garamond-latin-500-italic.woff2",
  "fonts/jost-latin-300-normal.woff2",
  "fonts/jost-latin-400-normal.woff2",
  "fonts/jost-latin-500-normal.woff2",
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
