import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FooterCTASection() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Stop guessing what your competitors are doing
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Join hundreds of founders and marketing leaders who stay ahead with
          AI-powered competitive intelligence. Setup takes 2 minutes.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="bg-cta px-8 text-lg text-brand-950 hover:bg-cta-hover"
          >
            <Link href="/sign-up">
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
