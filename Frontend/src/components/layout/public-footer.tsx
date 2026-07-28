import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { PRIMARY_CTA_HREF, primaryCtaLabel } from "@/lib/utils/signup-flag";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/product", label: "How it works" },
      { href: "/sample-report", label: "The brief" },
      { href: "/pricing", label: "Pricing" },
      { href: PRIMARY_CTA_HREF, label: primaryCtaLabel("Get started") },
    ],
  },
  {
    heading: "Compare",
    links: [
      { href: "/compare/crayon-alternative", label: "vs Crayon" },
      { href: "/compare/klue-alternative", label: "vs Klue" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/security", label: "Security" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/aup", label: "Acceptable use" },
      { href: "/legal/dpa", label: "DPA" },
      { href: "/legal/sub-processors", label: "Sub-processors" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-ink/[0.08] bg-obsidian-950">
      {/* Masthead colophon — the closing line of the publication. */}
      <div className="mx-auto max-w-6xl px-6 pt-16 sm:px-8">
        <div className="grid gap-10 border-b border-ink/[0.08] pb-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="max-w-md">
            <Logo />
            <p className="mt-4 text-body-lg text-muted-foreground measure-tight">
              You and your competitors, run through the same intelligence
              engine, and the gap between them, filed every Monday.
            </p>
          </div>
          <p className="font-mono text-label uppercase text-muted-foreground md:text-right">
            Competitive self-awareness
            <br className="hidden md:block" /> for teams that compete to win
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h4 className="font-mono text-label uppercase text-ink/55">
                {column.heading}
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-12 font-mono text-xs text-muted-foreground/70">
          &copy; {new Date().getFullYear()} Kironyx &middot; AI-assisted
          analysis; every finding cites its sources.
        </p>
      </div>
    </footer>
  );
}
