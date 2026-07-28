import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppProviders } from "@/lib/providers/app-providers";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://main.d1zrq9gf129s9u.amplifyapp.com";

const SITE_DESCRIPTION =
  "One engine, pointed both ways. Kironyx runs the same AI deep research on your competitors and on your own brand, then files the gap between them in a weekly brief. Competitive intelligence and brand monitoring in one, at a fraction of enterprise pricing.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "Kironyx: AI competitive intelligence + brand monitoring, in one",
    template: "%s | Kironyx",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Kironyx",
    url: SITE_URL,
    title: "Kironyx: your brand and your rivals, seen through one lens",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Kironyx: your brand and your rivals, seen through one lens",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {/* StorageNotice mounts per route-group layout so it inherits each
            surface's theme scope (warm on marketing, cool in the app) */}
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
