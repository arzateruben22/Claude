"use client";
// Settings → Notifications: turn push on for this browser (service worker + PushManager, with the studio's VAPID
// public key, the only key that ever reaches the browser) and the list of devices that get notifications. The server
// never sends endpoints here: each device comes with a hash of its endpoint, and this browser hashes its own to find
// "this device". Without JavaScript the list and Remove still work; turning a device on needs it.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { forgetPushEndpoint, pushPublicKey, removePushDevice, savePushDevice } from "@/app/actions";
import type { NotificationsView } from "@/lib/data";
import { ActionForm } from "./ActionForm";

type Support = "checking" | "ok" | "unsupported" | "install" | "blocked";

const b64uToBytes = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const sameBytes = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a || a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
};
async function hashOf(endpoint: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}
function guessLabel() {
  const ua = navigator.userAgent;
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad"
    : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : /Linux/.test(ua) ? "Linux" : "This device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${device} · ${browser}` : device;
}
const isAppleMobile = () => /iPhone|iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** A browser step that may never answer (a push service it can't reach): give up after `ms` with words for the owner. */
const within = <T,>(p: Promise<T>, ms: number, why: string) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(why)), ms))]);

async function registration() {
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await within(navigator.serviceWorker.ready, 15_000, "the service worker didn't start");
  return reg;
}

const SUPPORT_TEXT: Record<Exclude<Support, "ok" | "checking">, string> = {
  unsupported: "This browser can't receive web push notifications. Try Chrome, Edge, Firefox or Safari.",
  install: "On iPhone and iPad, notifications come to the Home Screen app: Share → Add to Home Screen, open Prism Studio from there, then turn them on here.",
  blocked: "Notifications are blocked for this site. Allow them in the browser's site settings, then reload this page.",
};

export function PushDevices({ devices, canUse }: { devices: NotificationsView["devices"]; canUse: boolean }) {
  const router = useRouter();
  const [support, setSupport] = useState<Support>("checking");
  const [mine, setMine] = useState<{ endpoint: string; hash: string } | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      setLabel((l) => l || guessLabel());
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setSupport(isAppleMobile() && !standalone() ? "install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") { setSupport("blocked"); return; }
      setSupport("ok");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (live && sub) setMine({ endpoint: sub.endpoint, hash: await hashOf(sub.endpoint) });
    })().catch(() => { if (live) setSupport("unsupported"); });
    return () => { live = false; };
  }, []);

  const on = !!mine && devices.some((d) => d.hash === mine.hash);

  async function turnOn() {
    setBusy(true); setMsg(null);
    try {
      // ask first, straight from the tap (Safari only shows the prompt for a user gesture)
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") setSupport("blocked");
        setMsg({ ok: false, text: "Notifications weren't allowed, so nothing changed." });
        return;
      }
      const k = await pushPublicKey();
      const publicKey = k?.ok ? String(k.data?.publicKey ?? "") : "";
      if (!publicKey) { setMsg({ ok: false, text: k?.message || "Couldn't get the studio's key. Nothing changed." }); return; }
      const key = b64uToBytes(publicKey);
      const reg = await registration();
      let sub = await reg.pushManager.getSubscription();
      if (sub && !sameBytes(sub.options.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }   // made for an older key
      sub ??= await within(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }), 30_000, "no answer from the browser's push service; check the connection and try again");
      const j = sub.toJSON();
      const r = await savePushDevice({ endpoint: j.endpoint, keys: j.keys, label });
      setMsg({ ok: !!r?.ok, text: r?.message ?? "Something went wrong." });
      if (r?.ok) { setMine({ endpoint: sub.endpoint, hash: await hashOf(sub.endpoint) }); router.refresh(); }
    } catch (e) {
      setMsg({ ok: false, text: `Couldn't turn notifications on here${e instanceof Error && e.message ? ` (${e.message})` : ""}. Nothing changed.` });
    } finally { setBusy(false); }
  }

  async function turnOff() {
    if (!mine) return;
    setBusy(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      await sub?.unsubscribe();
      const r = await forgetPushEndpoint(mine.endpoint);
      setMsg({ ok: !!r?.ok, text: r?.message ?? "Something went wrong." });
      if (r?.ok) { setMine(null); router.refresh(); }
    } catch {
      setMsg({ ok: false, text: "Couldn't turn it off here. Remove it from the list instead." });
    } finally { setBusy(false); }
  }

  return (
    <div className="stack-sm">
      <div className="push-this">
        {support === "checking" ? <p className="faint push-note">Turning notifications on needs JavaScript and a browser with web push.</p>
          : support !== "ok" ? <p className="muted push-note">{SUPPORT_TEXT[support]}</p>
          : on ? (
            <>
              <p className="push-note"><span className="chip good">This device gets notifications</span></p>
              <button type="button" className="btn ghost small" onClick={turnOff} disabled={busy}>{busy ? "Working…" : "Turn off on this device"}</button>
            </>
          ) : canUse ? (
            <>
              <label className="field push-label">Name this device <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Phone · Safari" /></label>
              <button type="button" className="btn" onClick={turnOn} disabled={busy}>{busy ? "Working…" : "Notify this device"}</button>
            </>
          ) : <p className="muted push-note">Notifications can&apos;t be turned on until the problem above is fixed.</p>}
      </div>
      <p role="status" aria-live="polite" className={msg ? "status-line" : "sr-only"} style={msg && !msg.ok ? { color: "var(--bad)", fontWeight: 600 } : undefined}>{msg?.text ?? ""}</p>

      {devices.length ? (
        <ul className="devices" aria-label="Devices that get notifications">
          {devices.map((d) => (
            <li key={d.id} className="device">
              <span className="device-name">{d.label}{mine?.hash === d.hash ? <span className="faint"> · this device</span> : null}</span>
              <span className="device-meta">
                <span>via {d.service} push</span>
                <span>added {d.added}</span>
                <span>{d.lastSuccess ? `last delivered ${d.lastSuccess}` : "nothing delivered yet"}</span>
                {d.failures ? <span className="chip warn">{d.failures} failed send{d.failures === 1 ? "" : "s"}{d.lastError ? `: ${d.lastError}` : ""}</span> : null}
              </span>
              <ActionForm action={removePushDevice} className="device-remove" submit="Remove" submitClass="btn quiet small" confirm={`Stop notifications to ${d.label}?`}>
                <input type="hidden" name="deviceId" value={d.id} />
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : <p className="faint push-note">No device gets notifications yet.</p>}
    </div>
  );
}
