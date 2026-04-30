import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-brand-700 pb-4 text-sm text-muted-foreground">
        <Link href="/legal/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link href="/legal/terms" className="hover:text-foreground">
          Terms of Service
        </Link>
        <Link href="/legal/aup" className="hover:text-foreground">
          Acceptable Use
        </Link>
        <Link href="/legal/sub-processors" className="hover:text-foreground">
          Sub-processors
        </Link>
        <Link href="/legal/dpa" className="hover:text-foreground">
          DPA
        </Link>
      </nav>
      <article className="prose prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-lg prose-h3:text-base prose-p:text-sm prose-li:text-sm prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
        {children}
      </article>
    </div>
  );
}
