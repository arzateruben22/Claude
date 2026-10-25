"use client";
// Registers the service worker (offline shell, never caches private API data) and shows an offline banner.
import { useEffect, useState } from "react";

export function Pwa() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    const on = () => setOffline(!navigator.onLine);
    on();
    window.addEventListener("online", on); window.addEventListener("offline", on);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);
  return offline ? <div className="offline-banner" role="status">You're offline. Changes can't be saved until you reconnect.</div> : null;
}
