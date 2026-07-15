import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";

export function FooterCTASection() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <Reveal>
        <div className="relative isolate mx-auto max-w-4xl overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-12 text-center shadow-2xl shadow-primary/5">
          <div
            className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[500px] -translate-x-1/2 animate-aurora rounded-full bg-primary/20 blur-[90px]"
            aria-hidden
          />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Stop guessing — about them, or about yourself
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join hundreds of founders and marketing leaders who track their
            competitors and their own brand side by side. Setup takes 2 minutes.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
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
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
