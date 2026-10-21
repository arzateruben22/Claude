"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { UiTheme } from "@/generated/prisma/enums";
import { updateAppearanceAction } from "@/lib/profile/actions";
import { THEME_PREVIEWS, type ThemePreview } from "@/lib/profile/constants";
import { cn } from "@/lib/utils";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Toggle } from "./toggle";
import { useSettingsAction } from "./use-settings-action";

/** Miniature layout painted with the theme's own token values (see globals.css). */
function ThemeSwatch({ swatches: s }: { swatches: ThemePreview["swatches"] }) {
  return (
    <div aria-hidden className="h-16 w-full overflow-hidden rounded-ctl border" style={{ background: s.bg, borderColor: s.line }}>
      <div className="flex h-full gap-1.5 p-1.5">
        <div className="w-1/4 rounded-sm" style={{ background: s.elevated }} />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="h-2 w-2/3 rounded-sm" style={{ background: s.fg, opacity: 0.85 }} />
          <div className="flex-1 rounded-sm" style={{ background: s.elevated }} />
          <div className="flex gap-1">
            <span className="h-2 w-8 rounded-sm" style={{ background: s.accent }} />
            <span className="h-2 w-5 rounded-sm" style={{ background: s.gold }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppearanceForm({ theme: initialTheme, reducedMotion: initialReduced }: { theme: UiTheme; reducedMotion: boolean }) {
  const router = useRouter();
  const [theme, setTheme] = useState<UiTheme>(initialTheme);
  const [reducedMotion, setReducedMotion] = useState(initialReduced);
  // Apply to <html> right away so the change is visible before the layout re-renders.
  const applied = useCallback(() => {
    document.documentElement.dataset.theme = theme.toLowerCase();
    document.documentElement.dataset.reducedMotion = reducedMotion ? "true" : "false";
    router.refresh();
  }, [theme, reducedMotion, router]);
  const [state, action, pending] = useSettingsAction(updateAppearanceAction, applied);

  return (
    <form action={action} noValidate className="space-y-4" aria-label="Appearance">
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Applies to every page as soon as you save.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="sr-only">Theme</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {THEME_PREVIEWS.map((t) => {
                const selected = theme === t.value;
                return (
                  <label
                    key={t.value}
                    className={cn(
                      "relative block cursor-pointer rounded-card border p-3 transition-colors",
                      selected ? "border-accent shadow-glow bg-accent-soft/40" : "border-line hover:border-line-strong",
                    )}
                  >
                    <input type="radio" name="theme" value={t.value} checked={selected} onChange={() => setTheme(t.value)} className="peer sr-only" />
                    <span aria-hidden className="pointer-events-none absolute inset-0 rounded-card ring-2 ring-accent/50 opacity-0 peer-focus-visible:opacity-100" />
                    <ThemeSwatch swatches={t.swatches} />
                    <span className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-fg">{t.name}</span>
                      {t.value === "CYBER" && <Badge tone="accent">Default</Badge>}
                      {selected && t.value !== "CYBER" && <Badge tone="success">Selected</Badge>}
                    </span>
                    <span className="mt-0.5 block text-xs text-fg-muted">{t.tagline}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Motion</CardTitle>
            <CardDescription>Also honoured automatically when your device asks for reduced motion.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Toggle
            id="reducedMotion"
            name="reducedMotion"
            label="Reduce motion"
            description="Turns off entrance animations, glows that pulse and chart transitions."
            checked={reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Apply appearance
        </Button>
      </div>
    </form>
  );
}
