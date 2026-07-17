import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, TrendingUp } from "lucide-react";
import { HeroMockup } from "./hero-mockup";
import { CategoryMarquee } from "./category-marquee";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-32">
      {/* Aurora orbs */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-[70%] animate-aurora rounded-full bg-primary/20 blur-[120px] will-change-transform"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[400px] w-[520px] translate-x-[5%] animate-aurora-slow rounded-full bg-cta/10 blur-[100px] will-change-transform"
        aria-hidden
      />
      {/* Blueprint grid */}
      <div
        className="pointer-events-none absolute inset-0 bg-grid-fade opacity-60"
        aria-hidden
      />
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex animate-fade-up items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary shadow-[0_0_20px_-5px] shadow-primary/30">
          <Zap className="h-3.5 w-3.5" />
          Competitive intelligence + brand monitoring in one
        </div>

        <h1 className="animate-fade-up text-4xl font-bold leading-tight tracking-tight [animation-delay:100ms] sm:text-5xl md:text-6xl">
          Know what your competitors did this week
          <br />
          —{" "}
          <span className="text-gradient-primary animate-gradient-shift">
            and exactly where you stand
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg text-muted-foreground [animation-delay:200ms] sm:text-xl">
          Stop manually checking competitor websites. Kironyx runs the same
          AI deep research on your competitors and on your own brand, then
          shows you the gap — so you act on where you stand, not on guesses.
        </p>

        <div className="mt-10 flex animate-fade-up flex-col items-center gap-4 [animation-delay:300ms] sm:flex-row sm:justify-center">
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-1 animate-glow-pulse rounded-lg bg-cta/40 blur-md"
              aria-hidden
            />
            <Button
              asChild
              size="lg"
              className="relative bg-cta px-8 text-lg text-brand-950 shadow-lg shadow-cta/25 transition-shadow hover:bg-cta-hover hover:shadow-cta/40"
            >
              <Link href="/sign-up">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="text-lg transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <Link href="/pricing">View Pricing</Link>
          </Button>
        </div>

        <div className="mt-12 flex animate-fade-up flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground [animation-delay:450ms]">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-significance-low" />
            No credit card required
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-cta" />
            Setup in 2 minutes
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            1/200th the price of enterprise tools
          </div>
        </div>
      </div>

      <div className="relative">
        <HeroMockup />
        <CategoryMarquee />
      </div>
    </section>
  );
}
