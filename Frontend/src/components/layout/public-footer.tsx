import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Separator } from "@/components/ui/separator";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/product", label: "How it works" },
      { href: "/sample-report", label: "Sample report" },
      { href: "/pricing", label: "Pricing" },
      { href: "/sign-up", label: "Get started" },
    ],
  },
  {
    heading: "Compare",
    links: [
      { href: "/compare/crayon-alternative", label: "Crayon alternative" },
      { href: "/compare/klue-alternative", label: "Klue alternative" },
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
      { href: "/legal/terms", label: "Terms of Service" },
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/aup", label: "Acceptable Use" },
      { href: "/legal/dpa", label: "DPA" },
      { href: "/legal/sub-processors", label: "Sub-processors" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-ink/[0.06] bg-obsidian-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-6">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Competitive intelligence + brand monitoring in one. Know what
              your market did this week — and where you stand.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h4 className="font-mono text-xs uppercase tracking-[0.08em] text-ink/55">
                {column.heading}
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8 bg-ink/[0.06]" />

        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Kironyx. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
