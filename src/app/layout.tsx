import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const latin = Inter({ variable: "--font-latin", subsets: ["latin"], display: "swap" });
const thai = Noto_Sans_Thai({ variable: "--font-thai", subsets: ["thai"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "EngThai Trainer", template: "%s · EngThai Trainer" },
  description: "Local-first English–Thai sentence training. Works offline, stores nothing on a server.",
  applicationName: "EngThai Trainer",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${latin.variable} ${thai.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
