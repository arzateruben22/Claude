import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prism Studio", short_name: "Prism", description: "A phone-first studio for five educational channels.",
    start_url: "/", scope: "/", display: "standalone", orientation: "portrait", background_color: "#05060A", theme_color: "#05060A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Upload Desk", url: "/upload" }, { name: "Review", url: "/review" }],
  };
}
