"use client";

import { useState } from "react";
import { Button, Alert } from "@/components/ui";
import { useIsMounted } from "@/lib/hooks";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Status = "idle" | "working" | "enabled" | "disabled" | "error";

/** Enables/disables web push on this device. Only rendered when the server has VAPID keys. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const mounted = useIsMounted();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  if (!mounted) return null;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    return (
      <Alert tone="info" title="Push isn't available in this browser">
        On iPhone, push works only after adding CareerQuest to your Home Screen (iOS 16.4 or later). Reminders always appear in this page.
      </Alert>
    );
  }

  async function enable() {
    setStatus("working");
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("disabled");
        setMessage("Permission was not granted. You can change this in your browser settings.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const res = await fetch("/api/notifications/push-subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Server rejected the subscription");
      setStatus("enabled");
      setMessage("Push is on for this device. Also tick “Push to this device” in preferences.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Could not enable push.");
    }
  }

  async function disable() {
    setStatus("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await fetch("/api/notifications/push-subscription", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub?.endpoint }),
      });
      await sub?.unsubscribe();
      setStatus("disabled");
      setMessage("Push is off for this device.");
    } catch {
      setStatus("error");
      setMessage("Could not disable push.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={enable} loading={status === "working"}>
          Enable push on this device
        </Button>
        <Button variant="secondary" onClick={disable} disabled={status === "working"}>
          Disable
        </Button>
      </div>
      {message && <Alert tone={status === "error" ? "danger" : "info"}>{message}</Alert>}
    </div>
  );
}
