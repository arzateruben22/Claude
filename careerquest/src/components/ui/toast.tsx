"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMounted } from "@/lib/hooks";

type Toast = { id: number; title: string; description?: string; tone: "success" | "info" | "danger" };
type Ctx = { push: (t: Omit<Toast, "id">) => void };

const ToastContext = React.createContext<Ctx>({ push: () => undefined });

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const mounted = useIsMounted();
  const push = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
  }, []);
  const ctx = React.useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-20 sm:bottom-6 right-4 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm" aria-live="polite">
            {toasts.map((t) => {
              const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "danger" ? XCircle : Info;
              return (
                <div key={t.id} className={cn("glass-strong rounded-ctl px-3.5 py-3 flex items-start gap-2.5 text-sm animate-rise bg-bg-elevated")}>
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", t.tone === "success" && "text-success", t.tone === "danger" && "text-danger", t.tone === "info" && "text-info")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.title}</p>
                    {t.description && <p className="text-xs text-fg-muted mt-0.5">{t.description}</p>}
                  </div>
                  <button type="button" aria-label="Dismiss" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} className="text-fg-subtle hover:text-fg">
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
