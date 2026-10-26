import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Pwa } from "@/components/Pwa";

export const metadata: Metadata = {
  title: { default: "Prism Studio", template: "%s · Prism Studio" },
  description: "A phone-first studio for five educational channels.",
  applicationName: "Prism Studio",
  appleWebApp: { capable: true, title: "Prism", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#05060A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Pwa />
        {children}
      </body>
    </html>
  );
}
