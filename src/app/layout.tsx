import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileGate } from "@/components/profiles/ProfileGate";
import { GATE_INIT_SCRIPT } from "@/components/profiles/gateScript";
import { DISPLAY_INIT_SCRIPT } from "@/components/display/preferences";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme";
import "./globals.css";

const latin = Inter({ variable: "--font-latin", subsets: ["latin"], display: "swap" });
const thai = Noto_Sans_Thai({ variable: "--font-thai", subsets: ["thai"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "EngThai Trainer", template: "%s · EngThai Trainer" },
  description: "Local-first English–Thai sentence training. Works offline, stores nothing on a server.",
  applicationName: "EngThai Trainer",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "EngThai", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${latin.variable} ${thai.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: GATE_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ProfileGate>
          <AppShell>{children}</AppShell>
        </ProfileGate>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
