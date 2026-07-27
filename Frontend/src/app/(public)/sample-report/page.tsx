import { Metadata } from "next";
import Link from "next/link";
import { Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/utils";
import { PRIMARY_CTA_HREF, primaryCtaLabel } from "@/lib/utils/signup-flag";

export const metadata: Metadata = {
  title: "Sample Report — What Lands in Your Inbox",
  description:
    "An illustrative Kironyx weekly strategic brief: scored competitor moves, recommendations, and where your brand stands — with fictional companies.",
};

const TOP_MOVES = [
  {
    company: "Northwind",
    category: "Funding",
    significance: 9,
    headline: "Raised a $12M Series A led by a top-tier fund to expand into EMEA",
    impact:
      "Northwind now has the balance sheet to outspend you on acquisition in the mid-market segment. Expect aggressive hiring and pricing pressure within two quarters.",
  },
  {
    company: "Acme Analytics",
    category: "Product",
    significance: 8,
    headline: "Launched usage-based pricing for their enterprise tier",
    impact:
      "This reframes the pricing conversation in your category from seats to usage. Prospects will start asking how your pricing compares on variable workloads.",
  },
  {
    company: "BoldMetrics",
    category: "Hiring",
    significance: 6,
    headline: "Posted 4 senior enterprise sales roles across EMEA in one week",
    impact:
      "A coordinated enterprise sales push is forming. Their motion has been product-led until now — this is a strategy shift worth tracking over the next cycle.",
  },
];

const RECOMMENDATIONS = [
  {
    priority: "High",
    text: "Publish a pricing-comparison page before Acme's usage-based model becomes the category default prospects anchor on.",
  },
  {
    priority: "Medium",
    text: "Brief the sales team on Northwind's funding: expect them in more deals, and prepare a 'well-funded but unproven in your segment' counter.",
  },
  {
    priority: "Medium",
    text: "Your share of voice lead is narrowing (34% → trending down 2pts). Two customer stories are unpublished — shipping them this week is the cheapest counter.",
  },
];

const SOV = [
  { name: "You", pct: 34, cls: "bg-primary", self: true },
  { name: "Acme Analytics", pct: 28, cls: "bg-blue-500" },
  { name: "Northwind", pct: 22, cls: "bg-blue-500/70" },
  { name: "BoldMetrics", pct: 16, cls: "bg-blue-500/40" },
];

function significanceClasses(score: number) {
  if (score >= 8) return "bg-significance-high/10 text-significance-high";
  if (score >= 6) return "bg-significance-medium/10 text-significance-medium";
  return "bg-significance-low/10 text-significance-low";
}

export default function SampleReportPage() {
  return (
    <>
      <PageHero
        eyebrow="Sample report"
        title={
          <>
            This is what lands in your inbox{" "}
            <span className="text-gradient-primary">every Monday</span>
          </>
        }
        description="A real-shape Kironyx weekly strategic brief. The companies below are fictional; the structure, scoring, and analysis mirror exactly what the product produces."
      />

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {/* Fictional-data notice */}
          <Reveal>
            <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-ink/75">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Illustrative example using fictional companies. In your
                workspace, every finding links to the web sources it was drawn
                from so you can verify the evidence.
              </p>
            </div>
          </Reveal>

          {/* The brief */}
          <Reveal delay={80}>
            <article className="mt-8 overflow-hidden rounded-xl border border-ink/10 bg-obsidian-900 shadow-[inset_0_1px_0_rgba(225,217,193,0.08)]">
              {/* Briefing masthead */}
              <header className="border-b border-ink/[0.06] bg-obsidian-950/60 px-6 py-5">
                <div className="flex items-center justify-between font-mono text-label uppercase text-ink/45">
                  <span>Kironyx briefing</span>
                  <span className="nums-tabular">Week of 21 Jul</span>
                </div>
                <h2 className="mt-3 font-display text-headline font-medium text-foreground">
                  What moved this week — and where you stand.
                </h2>
                <p className="mt-1.5 text-sm text-ink/55">
                  Your workspace · 4 tracked companies + your brand · 12 changes
                  detected
                </p>
              </header>

              <div className="space-y-10 px-6 py-8">
                {/* At a glance */}
                <div>
                  <h3 className="font-mono text-label uppercase text-ink/55">
                    At a glance
                  </h3>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Brand Health", value: "74/100" },
                      { label: "Share of Voice", value: "34% · #1" },
                      { label: "Changes (7d)", value: "12" },
                      { label: "High threat", value: "1 rival" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg border border-ink/[0.06] bg-obsidian-950/50 p-3"
                      >
                        <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
                        <p className="mt-0.5 text-xs text-ink/55">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top moves */}
                <div>
                  <h3 className="font-mono text-label uppercase text-ink/55">
                    The moves that matter
                  </h3>
                  <div className="mt-4 space-y-4">
                    {TOP_MOVES.map((move) => (
                      <div
                        key={move.headline}
                        className="rounded-lg border border-ink/[0.06] bg-obsidian-950/50 p-4"
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-medium text-ink/70">
                            {move.category}
                          </span>
                          <span className="text-ink/55">{move.company}</span>
                          <span
                            className={cn(
                              "ml-auto shrink-0 rounded-full px-2 py-0.5 font-medium tabular-nums",
                              significanceClasses(move.significance)
                            )}
                          >
                            Significance {move.significance}/10
                          </span>
                        </div>
                        <p className="mt-2 font-medium leading-snug">{move.headline}</p>
                        <p className="mt-2 text-sm leading-relaxed text-ink/70">
                          <span className="font-medium text-ink/85">Why it matters: </span>
                          {move.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="font-mono text-label uppercase text-ink/55">
                    Recommended actions
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {RECOMMENDATIONS.map((rec) => (
                      <li key={rec.text} className="flex items-start gap-3 text-sm">
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            rec.priority === "High"
                              ? "bg-significance-high/10 text-significance-high"
                              : "bg-significance-medium/10 text-significance-medium"
                          )}
                        >
                          {rec.priority}
                        </span>
                        <span className="leading-relaxed text-ink/75">{rec.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Where you stand */}
                <div>
                  <h3 className="font-mono text-label uppercase text-ink/55">
                    Where you stand · share of voice, 30d
                  </h3>
                  <div className="mt-4 space-y-2.5">
                    {SOV.map((row) => (
                      <div key={row.name} className="flex items-center gap-3">
                        <span
                          className={
                            row.self
                              ? "w-28 shrink-0 text-xs font-semibold text-primary"
                              : "w-28 shrink-0 text-xs text-ink/55"
                          }
                        >
                          {row.name}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-obsidian-800">
                          <div
                            className={`h-full rounded-full ${row.cls}`}
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink/55">
                          {row.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Disclaimer footer — mirrors the real product's AI disclaimer */}
              <footer className="border-t border-ink/[0.06] bg-obsidian-950/60 px-6 py-4">
                <p className="text-xs leading-relaxed text-ink/45">
                  AI-assisted analysis. Findings should be verified against the
                  cited primary sources before making decisions. May contain
                  errors.
                </p>
              </footer>
            </article>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-10 text-center">
              <Button
                asChild
                size="lg"
                className="group bg-cta px-8 text-obsidian-950 shadow-lg shadow-cta/20 transition-[transform,background-color,box-shadow] duration-150 ease-out-strong hover:bg-cta-hover hover:shadow-cta/30 active:scale-[0.97]"
              >
                <Link href={PRIMARY_CTA_HREF}>
                  {primaryCtaLabel("Get your first brief this week")}
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-150 ease-out-strong group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <p className="mt-3 text-sm text-ink/55">
                Research starts within minutes of setup. Your own brand is
                benchmarked from day one.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
