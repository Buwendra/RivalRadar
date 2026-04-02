import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Separator } from "@/components/ui/separator";

export function PublicFooter() {
  return (
    <footer className="border-t border-brand-700 bg-brand-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              AI-powered competitive intelligence for SMBs. Know what your
              competitors are doing — automatically.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Product</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/sign-up" className="hover:text-foreground">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Company</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground">
                  About
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-brand-700" />

        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} RivalScan. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
