"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRIMARY_CTA_HREF, primaryCtaLabel } from "@/lib/utils/signup-flag";

const NAV_LINKS = [
  { href: "/product", label: "How it works" },
  { href: "/sample-report", label: "The brief" },
  { href: "/pricing", label: "Pricing" },
];

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-ink/[0.08] bg-obsidian-950/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8">
        <div className="flex items-center gap-10">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            aria-label="Kironyx home"
          >
            <Logo />
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "font-mono text-[0.8125rem] tracking-tight transition-colors hover:text-foreground",
                    active
                      ? "text-foreground underline decoration-foreground/40 decoration-1 underline-offset-[7px]"
                      : "text-muted-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
          >
            <Link href="/sign-in">Log in</Link>
          </Button>
          {/* Primary CTA — stays visible on mobile, outside the hamburger. */}
          <Button
            asChild
            size="sm"
            className="bg-cta text-obsidian-950 transition-[transform,background-color] duration-150 ease-out-strong hover:bg-cta-hover active:scale-[0.97]"
          >
            <Link href={PRIMARY_CTA_HREF}>{primaryCtaLabel("Start free trial")}</Link>
          </Button>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-ink/[0.06] hover:text-foreground md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-ink/[0.08] bg-obsidian-950/97 px-6 pb-5 pt-3 backdrop-blur-lg md:hidden">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-2 py-3 font-mono text-sm transition-colors hover:bg-ink/[0.04] hover:text-foreground",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/sign-in"
            onClick={() => setMobileOpen(false)}
            className="block rounded-md px-2 py-3 font-mono text-sm text-muted-foreground transition-colors hover:bg-ink/[0.04] hover:text-foreground"
          >
            Log in
          </Link>
        </div>
      )}
    </nav>
  );
}
