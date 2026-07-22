"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/sample-report", label: "Sample Report" },
  { href: "/pricing", label: "Pricing" },
];

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-ink/[0.06] bg-obsidian-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" onClick={() => setMobileOpen(false)}>
            <Logo />
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm transition-colors hover:text-foreground",
                  pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href="/sign-in">Log in</Link>
          </Button>
          {/* CTA stays visible on mobile, outside the hamburger */}
          <Button
            asChild
            size="sm"
            className="bg-cta text-obsidian-950 transition-all hover:bg-cta-hover active:scale-[0.98]"
          >
            <Link href="/sign-up">Start Free Trial</Link>
          </Button>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-md p-2 text-muted-foreground hover:bg-ink/[0.06] hover:text-foreground md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-ink/[0.06] bg-obsidian-950/95 px-4 pb-4 pt-2 backdrop-blur-lg md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block rounded-md px-2 py-3 text-sm transition-colors hover:bg-ink/[0.04] hover:text-foreground",
                pathname === link.href
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/sign-in"
            onClick={() => setMobileOpen(false)}
            className="block rounded-md px-2 py-3 text-sm text-muted-foreground transition-colors hover:bg-ink/[0.04] hover:text-foreground"
          >
            Log in
          </Link>
        </div>
      )}
    </nav>
  );
}
