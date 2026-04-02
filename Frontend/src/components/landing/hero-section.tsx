import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, TrendingUp } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-32">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
          <Zap className="h-3.5 w-3.5" />
          AI-Powered Competitive Intelligence
        </div>

        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Know what your competitors{" "}
          <span className="text-primary">did this week</span>
          <br />
          — automatically
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Stop manually checking competitor websites. RivalScan monitors
          your competitors daily with AI, then delivers strategic briefs
          so you can act — not just observe.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="bg-cta px-8 text-lg text-brand-950 hover:bg-cta-hover"
          >
            <Link href="/sign-up">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-lg">
            <Link href="/pricing">View Pricing</Link>
          </Button>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
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
    </section>
  );
}
