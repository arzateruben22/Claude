// Prism Studio service worker: an offline shell and push notifications. Private data (pages, API, media) is never
// cached; it always comes from the network, so a shared or lost phone can't replay the studio from cache.
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

// Push notifications (Settings → Notifications). The payload is { title, body, url, tag }, encrypted for this browser
// by the studio. A click opens that screen of the studio (same origin only), reusing an open window when there is one.
self.addEventListener("push", (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { body: e.data ? e.data.text() : "" }; }
  const title = typeof m.title === "string" && m.title ? m.title : "Prism Studio";
  e.waitUntil(self.registration.showNotification(title, {
    body: typeof m.body === "string" ? m.body : "",
    icon: "/icons/icon-192.png",
    tag: typeof m.tag === "string" && m.tag ? m.tag : undefined,
    renotify: typeof m.tag === "string" && !!m.tag,
    data: { url: typeof m.url === "string" ? m.url : "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  let url;
  try { url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin); } catch { url = new URL("/", self.location.origin); }
  if (url.origin !== self.location.origin) url = new URL("/", self.location.origin);   // never open another site
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = open.find((c) => new URL(c.url).origin === url.origin && "focus" in c);
    if (win) {
      try { await win.focus(); if ("navigate" in win) await win.navigate(url.href); return; } catch { /* not controlled: open a window instead */ }
    }
    await self.clients.openWindow(url.href);
  })());
});

// The browser replaced this device's subscription: send the new one so notifications keep arriving (owner-only route;
// the session cookie goes with it). If that fails, Settings shows this device as off and one tap turns it back on.
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil((async () => {
    const old = e.oldSubscription;
    const sub = e.newSubscription || (old && old.options ? await self.registration.pushManager.subscribe(old.options) : null);
    if (!sub) return;
    await fetch("/api/push/subscription", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), replaces: old ? old.endpoint : null }),
    });
  })().catch(() => {}));
});
