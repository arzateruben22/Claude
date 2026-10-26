// The New York night behind everything. Two fixed layers drawn with CSS backgrounds (so a missing file simply shows
// the deep indigo fallback gradient underneath, never a broken image): the soft one (blurred, darkened, under a dark
// scrim) behind every inner page, and the crisp one the monitor wall lays over it. Files: public/wallpaper/
// skyline-landscape.jpg (3840×2160), skyline-portrait.jpg (1440×3120, used under 720 px) and skyline-soft.jpg.
export function Wallpaper({ variant }: { variant: "soft" | "crisp" }) {
  return <div className={`wall wall-${variant}`} aria-hidden />;
}
