import Link from "next/link";
import { Dateline } from "@/components/marketing/editorial";

const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/aup", label: "Acceptable Use" },
  { href: "/legal/sub-processors", label: "Sub-processors" },
  { href: "/legal/dpa", label: "DPA" },
];

/**
 * Legal reading column. @tailwindcss/typography is not installed, so instead
 * of the (inert) prose-* classes this styles descendant elements directly via
 * arbitrary-variant selectors — Fraunces headings, a measured body, and quiet
 * underlined links — so legal reads like the rest of the publication.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
      <Dateline>Legal</Dateline>
      <nav className="mb-10 mt-5 flex flex-wrap gap-x-6 gap-y-2 border-b border-ink/[0.08] pb-5 font-mono text-sm text-muted-foreground">
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="transition-colors hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <article
        className={[
          "max-w-none",
          "[&_h1]:font-display [&_h1]:text-display-m [&_h1]:font-medium [&_h1]:mb-3",
          "[&_h2]:font-display [&_h2]:text-headline [&_h2]:font-medium [&_h2]:mt-12 [&_h2]:mb-3",
          "[&_h3]:font-display [&_h3]:text-title [&_h3]:mt-8 [&_h3]:mb-2",
          "[&_p]:text-body-lg [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_p]:my-4",
          "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ul]:marker:text-ink/30",
          "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_ol]:marker:text-ink/30",
          "[&_li]:text-body-lg [&_li]:leading-relaxed [&_li]:text-muted-foreground",
          "[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-foreground/80",
          "[&_strong]:font-semibold [&_strong]:text-foreground",
          "[&_hr]:my-10 [&_hr]:border-ink/10",
          "[&_table]:my-6 [&_table]:w-full [&_table]:text-sm",
          "[&_th]:border-b [&_th]:border-ink/10 [&_th]:py-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-label [&_th]:uppercase [&_th]:text-muted-foreground",
          "[&_td]:border-b [&_td]:border-ink/[0.06] [&_td]:py-2 [&_td]:align-top [&_td]:text-muted-foreground",
        ].join(" ")}
      >
        {children}
      </article>
    </div>
  );
}
