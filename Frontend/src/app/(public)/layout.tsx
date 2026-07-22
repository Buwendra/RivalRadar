import { Fraunces } from "next/font/google";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { CookieNoticeBanner } from "@/components/shared/cookie-notice-banner";
import { StorageNotice } from "@/components/shared/storage-notice";

// Editorial serif for marketing display headings. Declared here (not the
// root layout) so the font payload is scoped to public routes only.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz"],
});

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`theme-forest flex min-h-screen flex-col bg-obsidian-950 ${fraunces.variable}`}
    >
      {/* Film-grain overlay: kills gradient banding on the dark canvas */}
      <div
        className="bg-noise pointer-events-none fixed inset-0 z-50 opacity-[0.025] mix-blend-overlay"
        aria-hidden
      />
      <PublicNavbar />
      <main className="flex-1">{children}</main>
      <PublicFooter />
      <CookieNoticeBanner />
      <StorageNotice />
    </div>
  );
}
