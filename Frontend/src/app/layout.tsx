import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppProviders } from "@/lib/providers/app-providers";
import { StorageNotice } from "@/components/shared/storage-notice";
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

export const metadata: Metadata = {
  title: {
    default: "Kironyx — AI Competitive Intelligence & Brand Monitoring for SMBs",
    template: "%s | Kironyx",
  },
  description:
    "Know what your competitors did this week — and exactly where you stand. AI deep research on them and on your own brand, side by side, at 1/200th the price of enterprise tools.",
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
        <AppProviders>
          {children}
          <StorageNotice />
        </AppProviders>
      </body>
    </html>
  );
}
