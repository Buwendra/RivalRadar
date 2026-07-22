import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroMockup } from "./hero-mockup";
import { CategoryMarquee } from "./category-marquee";
import { SignalCollapse } from "./signal-collapse";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28">
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
        className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[1100px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_38%,rgba(14,13,12,0.94)_0%,rgba(14,13,12,0.72)_42%,rgba(14,13,12,0)_72%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <p className="animate-fade-up font-mono text-xs uppercase tracking-[0.08em] text-primary/80">
          Competitive intelligence, pointed both ways
        </p>

        <h1 className="mt-5 animate-fade-up font-display text-4xl font-medium leading-[1.12] tracking-[-0.01em] [animation-delay:60ms] sm:text-5xl md:text-6xl">
          Know what your competitors did this week —&nbsp;and{" "}
          <em className="font-display italic text-primary">exactly</em> where
          you stand.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg text-ink/70 [animation-delay:120ms] sm:text-xl">
          Kironyx runs the same AI deep research on your competitors and on
          your own brand, then shows you the gap — so you act on where you
          stand, not on guesses.
        </p>

        <div className="mt-10 flex animate-fade-up flex-col items-center gap-5 [animation-delay:180ms] sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="bg-cta px-8 text-lg text-obsidian-950 shadow-lg shadow-cta/20 transition-all hover:bg-cta-hover hover:shadow-cta/30 active:scale-[0.98]"
          >
            <Link href="/sign-up">Start free trial</Link>
          </Button>
          <Link
            href="/sample-report"
            className="text-lg text-ink/70 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink/50"
          >
            Read a sample brief
          </Link>
        </div>

        <p className="mt-10 animate-fade-up text-sm text-ink/55 [animation-delay:240ms]">
          No card. Two-minute setup. From $49/month — the enterprise tools
          start around $20,000 a year.
        </p>
      </div>

      <div className="relative">
        <HeroMockup />
        <CategoryMarquee />
      </div>
    </section>
  );
}
