import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Kironyx exists: competitive intelligence was priced for enterprises and useless as free alerts. We built the layer in between — and pointed it at your own brand too.",
};

const PRINCIPLES = [
  {
    title: "Both directions or it's half a picture",
    description:
      "Knowing what competitors did without knowing where you stand is trivia, not intelligence. The same research engine runs on your brand — on every plan — because the comparison is the product.",
  },
  {
    title: "Evidence over vibes",
    description:
      "Every finding cites the web sources it was drawn from. Every score — threat, significance, momentum, brand health — has a published rubric you can read and challenge. If we can't show our work, we don't ship the claim.",
  },
  {
    title: "Honest about the AI",
    description:
      "AI-assisted analysis can be wrong. We say so on every surface that carries it — dashboard, emails, PDFs — and we never score your own brand as a threat or invent competitors' secrets. Verify before you act; we make that easy.",
  },
  {
    title: "Priced for the teams doing the work",
    description:
      "Competitive intelligence shouldn't require procurement. Public pricing, monthly contracts, self-serve setup — the way you'd want to buy software yourself.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title={
          <>
            Competitive intelligence had a{" "}
            <span className="text-gradient-primary">missing middle</span>
          </>
        }
        description="Enterprise platforms start at five figures a year. Free alerts forward noise. Kironyx exists for everyone in between."
      />

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6 text-[17px] leading-[1.65] text-ink/75">
          <Reveal>
            <p>
              Small teams lose deals to competitor moves they hear about weeks
              late — a pricing change, a funding round, a feature launch that
              reframed the category. The tools that catch those moves existed,
              but they were built for enterprises with dedicated analysts and
              budgets to match. Everyone else got keyword alerts and a guilty
              browser folder of competitor homepages.
            </p>
          </Reveal>
          <Reveal delay={60}>
            <p>
              Kironyx started as an attempt to close that gap with AI: deep
              research that actually reads the web the way an analyst would,
              compares this week to last week, scores what changed, and writes
              the brief. Along the way we noticed the sharper problem — teams
              didn&apos;t just lack intelligence about competitors. They lacked{" "}
              <em>competitive self-awareness</em>: an honest read on how their
              own brand stacked up in the same frame. So we pointed the engine
              both ways.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <p>
              Today Kironyx researches your competitors and your own brand with
              the identical pipeline, benchmarks the two, and delivers the gap
              — every Monday, and the same day anything big breaks.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-ink/[0.06] bg-obsidian-900/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
              What we believe
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((principle, index) => (
              <Reveal key={principle.title} delay={(index % 2) * 60}>
                <div className="h-full rounded-lg border border-ink/[0.08] bg-obsidian-900 p-6 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
                  <h3 className="font-semibold">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/70">
                    {principle.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
              See it on your own market
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-ink/70">
              The fastest way to judge Kironyx is to point it at your
              competitors — and yourself. Setup takes two minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-cta px-8 text-obsidian-950 shadow-lg shadow-cta/20 transition-all hover:bg-cta-hover active:scale-[0.98]"
              >
                <Link href="/sign-up">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-ink/15 transition-colors hover:border-ink/30 hover:bg-ink/[0.04]"
              >
                <Link href="/sample-report">Read a sample report</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
