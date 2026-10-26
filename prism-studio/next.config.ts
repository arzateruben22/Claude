import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // the worker and scripts run outside Next; the app reads media through /api/media (owner-only)
  serverExternalPackages: ["pg", "web-push"],
  async headers() {
    return [
      // the wallpaper files keep their names when re-rendered, so a week's cache (then revalidated in the background), not "immutable"
      { source: "/wallpaper/:file(.*\\.jpg)", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/(.*)", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ] },
    ];
  },
};
export default config;
