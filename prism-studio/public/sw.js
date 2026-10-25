// Prism Studio service worker: an offline shell only. Private data (pages, API, media) is never cached;
// it always comes from the network, so a shared or lost phone can't replay the studio from cache.
const SHELL = "prism-shell-v1";
const ASSETS = ["/offline", "/fonts/InstrumentSerif-Regular.woff2", "/fonts/InstrumentSerif-Italic.woff2", "/fonts/BricolageGrotesque-VF.woff2", "/fonts/JetBrainsMono-Medium.woff2", "/icons/icon-192.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  if (req.mode === "navigate") e.respondWith(fetch(req).catch(() => caches.match("/offline")));
});
