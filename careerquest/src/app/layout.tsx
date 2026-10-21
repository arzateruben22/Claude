import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "CareerQuest", template: "%s · CareerQuest" },
  description: "Real-world career simulator, universal job application tracker and California electrician career academy.",
  applicationName: "CareerQuest",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CareerQuest" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

async function resolveTheme(): Promise<{ theme: "cyber" | "ultra" | "classic"; reducedMotion: boolean }> {
  try {
    const user = await getSessionUser();
    if (!user) return { theme: "cyber", reducedMotion: false };
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { theme: true, reducedMotion: true },
    });
    return {
      theme: (profile?.theme.toLowerCase() as "cyber" | "ultra" | "classic") ?? "cyber",
      reducedMotion: profile?.reducedMotion ?? false,
    };
  } catch {
    return { theme: "cyber", reducedMotion: false };
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { theme, reducedMotion } = await resolveTheme();
  return (
    <html
      lang="en"
      data-theme={theme}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
