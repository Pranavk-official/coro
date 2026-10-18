import type { Metadata, Viewport } from "next";
import Providers from "@/components/providers";
import { ThemeBadge } from "@/components/layout/ThemeSwitcher";
import { SITE } from "@/lib/utils/site";
import "./globals.css";

// All pages are client-rendered behind useSession; dev instant-nav validation drops them and the
// HMR reload that follows loops on cold routes (Next 16.4). Opt out app-wide.
export const instant = false;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — free browser video calls`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ["video calls", "video conferencing", "online meeting", "WebRTC", "no download", "guest join", "waiting room"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: "/",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: `${SITE.name} — ${SITE.tagline}`, description: SITE.description },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: SITE.name },
};

// viewport-fit=cover: the call toolbar sits above the home indicator via env(safe-area-inset-*).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="relative min-h-full flex flex-col">
        <Providers>
          {children}
          <ThemeBadge />
        </Providers>
      </body>
    </html>
  );
}
