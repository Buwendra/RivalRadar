import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignalField } from "./signal-field";

export function FooterCTASection() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="relative isolate mx-auto max-w-4xl overflow-hidden rounded-2xl border border-ink/10 bg-gradient-to-b from-primary/[0.06] to-transparent p-12 text-center shadow-[inset_0_1px_0_rgba(225,217,193,0.08)]">
        {/* Closes the page by echoing the hero: everything funnels inward and
            is consumed at the centre, right behind the CTA. Negative z-index
            (inside the card's existing `isolate`) keeps it under the static
            content — positioned elements otherwise paint above non-positioned
            siblings regardless of DOM order. */}
        <SignalField mode="converge" className="-z-10" />

        <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
          Stop guessing — about them, or about yourself
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Kironyx exists because competitive intelligence shouldn&rsquo;t
          require a $20,000 contract and a quarterly business review.
          It&rsquo;s $49 a month, and it watches you as closely as it watches
          them.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="bg-cta px-8 text-lg text-obsidian-950 shadow-lg shadow-cta/20 transition-all hover:bg-cta-hover hover:shadow-cta/30 active:scale-[0.98]"
          >
            <Link href="/sign-up">Start your free trial</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
