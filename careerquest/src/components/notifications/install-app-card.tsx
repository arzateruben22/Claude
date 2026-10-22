"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui";
import { useIsMounted } from "@/lib/hooks";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallAppCard() {
  const mounted = useIsMounted();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (!mounted) return null;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (standalone || installed) return <p className="text-sm text-success">CareerQuest is installed on this device.</p>;
  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-center gap-2 text-fg-muted">
        <Smartphone className="h-4 w-4" aria-hidden /> Install CareerQuest for a full-screen app, the share target and push reminders.
      </p>
      {deferred ? (
        <Button
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          }}
        >
          Install app
        </Button>
      ) : ios ? (
        <ol className="list-decimal pl-5 text-fg-muted space-y-1">
          <li>Open CareerQuest in Safari.</li>
          <li>Tap the Share button, then “Add to Home Screen”.</li>
          <li>Open it from your Home Screen to enable push reminders.</li>
        </ol>
      ) : (
        <p className="text-fg-muted">Use your browser menu’s “Install app” or “Add to Home screen”.</p>
      )}
    </div>
  );
}
