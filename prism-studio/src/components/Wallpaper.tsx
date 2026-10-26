// The New York night behind everything. Two fixed layers drawn with CSS backgrounds (so a missing file simply shows
// the deep indigo fallback gradient underneath, never a broken image): the soft one (the same sharp skyline under a heavy
// scrim, so its silhouettes stay faintly visible) behind every inner page, and the crisp one the monitor wall and sign-in
// lay over it. Files: public/wallpaper/skyline-landscape.jpg (3840×2160, 2x screens), skyline-landscape-1920.jpg (1x)
// and skyline-portrait.jpg (1440×3120, used under 720 px).
export function Wallpaper({ variant }: { variant: "soft" | "crisp" }) {
  return <div className={`wall wall-${variant}`} aria-hidden />;
}
