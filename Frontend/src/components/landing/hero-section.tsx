import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroMockup } from "./hero-mockup";
import { CategoryMarquee } from "./category-marquee";
import { SignalCollapse } from "./signal-collapse";
import { PRIMARY_CTA_HREF, primaryCtaLabel } from "@/lib/utils/signup-flag";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 py-20 sm:px-8 sm:py-28">
      {/* Single anchored glow, kept faint — the grid carries the background */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[400px] w-[560px] -translate-x-1/2 animate-aurora rounded-full bg-primary/[0.06] blur-[120px] will-change-transform"
        aria-hidden
      />
      {/* Blueprint grid */}
      <div
        className="pointer-events-none absolute inset-0 bg-grid-fade opacity-40"
        aria-hidden
      />
      {/* Signal field: web noise implodes and resolves into the dashboard */}
      <SignalCollapse />
      {/* Contrast scrim so the copy stays legible over the field. The
          obsidian-950 literal is inlined because a gradient stop can't
          reference the Tailwind token. */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[620px] w-[1200px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_40%,rgba(14,13,12,0.97)_0%,rgba(14,13,12,0.85)_38%,rgba(14,13,12,0.45)_58%,rgba(14,13,12,0)_78%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <p className="animate-fade-up font-mono text-label uppercase text-primary/80">
          Competitive self-awareness
        </p>

        <h1 className="mx-auto mt-6 max-w-3xl animate-fade-up font-display text-display-xl font-medium [animation-delay:60ms]">
          Your brand and your rivals,{" "}
          <em className="italic">seen through one lens.</em>
        </h1>

        <p className="mx-auto mt-7 max-w-xl animate-fade-up text-standfirst text-ink/70 [animation-delay:120ms]">
          The same deep research on you and on your competitors. Then the gap
          between you, filed in one brief every Monday.
        </p>

        <div className="mt-10 flex animate-fade-up flex-col items-center gap-5 [animation-delay:180ms] sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="bg-cta px-8 text-lg text-obsidian-950 shadow-lg shadow-cta/20 transition-[transform,background-color,box-shadow] duration-150 ease-out-strong hover:bg-cta-hover hover:shadow-cta/30 active:scale-[0.97]"
          >
            <Link href={PRIMARY_CTA_HREF}>{primaryCtaLabel("Start free trial")}</Link>
          </Button>
          <Link
            href="/sample-report"
            className="text-lg text-ink/70 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink/50"
          >
            Read the brief
          </Link>
        </div>

      </div>

      <div className="relative">
        <HeroMockup />
        <CategoryMarquee />
      </div>
    </section>
  );
}
