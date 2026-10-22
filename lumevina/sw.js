/* Lumevina — service worker for the home-screen install
 *
 * Deliberately conservative so a client never gets a stale site:
 *   • pages, CSS and JS — network first, cached copy only when offline
 *   • fonts and images  — cache first (they never change in place)
 * Bump VERSION when an offline-page or caching rule changes. */

var VERSION = "lumevina-v4";
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

/* Lumevina Studio (the dashboard on Evelyn's phone): notifications from
   the server (functions/_shared/notify.ts) arrive here as { title, body, url, tag } */
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Lumevina Studio", {
    body: d.body || "",
    tag: d.tag || undefined,
    icon: "img/icon-192.png",
    badge: "img/icon-192.png",
    data: { url: d.url || "dashboard.html" }
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || "dashboard.html", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (/dashboard\.html/.test(list[i].url) && "focus" in list[i]) {
        if ("navigate" in list[i]) list[i].navigate(url);
        return list[i].focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  var url = new URL(req.url);
  /* only same-origin GETs — payments, Supabase and Stripe go straight out */
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  /* skin images and the functions are never cached, even if the site is ever
     served with a same-origin proxy in front of Supabase */
  if (/\/(storage|functions)\/v1\//.test(url.pathname)) return;

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
      if (res.ok && !/no-store|private/.test(res.headers.get("Cache-Control") || "")) {
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
