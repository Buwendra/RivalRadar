"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export function PublicNavbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-brand-700/50 bg-brand-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/">
          <Logo />
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/pricing"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline-block"
          >
            Pricing
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="bg-cta text-brand-950 hover:bg-cta-hover">
            <Link href="/sign-up">Start Free Trial</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
