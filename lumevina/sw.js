/* Lumevina — service worker for the home-screen install
 *
 * Deliberately conservative so a client never gets a stale site:
 *   • pages, CSS and JS — network first, cached copy only when offline
 *   • fonts and images  — cache first (they never change in place)
 * Bump VERSION when an offline-page or caching rule changes. */

var VERSION = "lumevina-v2";
var SHELL = [
  "./",
  "index.html",
  "css/styles.css",
  "img/apple-touch-icon.png",
  "img/icon-192.png",
  "img/logo-light.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

var isStatic = function (url) {
  return /\.(woff2|png|jpe?g|webp|avif|svg|ico)$/i.test(url.pathname);
};

self.addEventListener("fetch", function (e) {
  var req = e.request;
  var url = new URL(req.url);
  /* only same-origin GETs — payments, Supabase and Stripe go straight out */
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            caches.open(VERSION).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  e.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === "navigate") return caches.match("index.html");
        return Response.error();
      });
    })
  );
});
