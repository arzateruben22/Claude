import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic dynamic rendering: every authenticated page reads cookies + the database,
  // so Cache Components (static shells) adds complexity without benefit here.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["pg", "bcryptjs"],
  experimental: {
    // Uploads travel through Server Actions (multipart form posts): documents up to 10 MB,
    // .eml/.mbox email exports up to 25 MB and spreadsheets up to 10 MB. Next's default limit is
    // 1 MB; the limit applies to the raw request body including multipart overhead, so leave room.
    serverActions: { bodySizeLimit: "26mb" },
    // src/proxy.ts matches every app page, and the proxy buffers request bodies in memory up to
    // this size (default 10 MB) before the server action sees them; it must cover the same uploads.
    proxyClientMaxBodySize: "26mb",
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
};

export default nextConfig;
