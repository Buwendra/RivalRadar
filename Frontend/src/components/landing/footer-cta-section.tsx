import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignalField } from "./signal-field";
import { PRIMARY_CTA_HREF, primaryCtaLabel } from "@/lib/utils/signup-flag";

export function FooterCTASection() {
  return (
    <section className="px-6 py-24 sm:px-8">
      <div className="relative isolate mx-auto max-w-4xl overflow-hidden rounded-2xl border border-ink/10 bg-gradient-to-b from-primary/[0.06] to-transparent p-10 text-center shadow-[inset_0_1px_0_rgba(225,217,193,0.08)] sm:p-14">
        {/* Closes the page by echoing the hero: everything funnels inward and
            is consumed at the centre, right behind the CTA. Negative z-index
            (inside the card's existing `isolate`) keeps it under the static
            content — positioned elements otherwise paint above non-positioned
            siblings regardless of DOM order. */}
        <SignalField mode="converge" className="-z-10" />

        <h2 className="font-display text-display-m font-medium">
          Stop guessing — about them, or about yourself.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-body-lg text-muted-foreground">
          You already track your competitors in your head. Kironyx does it
          properly — and holds your own brand to the same standard, so every
          read arrives with where you actually stand.
        </p>
        <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="bg-cta px-8 text-lg text-obsidian-950 shadow-lg shadow-cta/20 transition-[transform,background-color,box-shadow] duration-150 ease-out-strong hover:bg-cta-hover hover:shadow-cta/30 active:scale-[0.97]"
          >
            <Link href={PRIMARY_CTA_HREF}>{primaryCtaLabel("Start your free trial")}</Link>
          </Button>
        </div>
        <p className="mt-5 font-mono text-xs text-muted-foreground">
          Monthly plans from $49 to $199 &middot; new workspaces onboarded
          within a day of your request
        </p>
      </div>
    </section>
  );
}
