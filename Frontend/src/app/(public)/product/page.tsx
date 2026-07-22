import { Metadata } from "next";
import Link from "next/link";
import {
  Globe,
  GitCompareArrows,
  Gauge,
  Send,
  Newspaper,
  Rocket,
  Banknote,
  Users,
  MessageSquare,
  Factory,
  TrendingUp,
  ShieldAlert,
  Tags,
  Mail,
  Bell,
  Slack,
  FileText,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/landing/reveal";
import { FooterCTASection } from "@/components/landing/footer-cta-section";

export const metadata: Metadata = {
  title: "Product — How Kironyx Works",
  description:
    "AI deep research runs on your competitors and your own brand, detects what changed, scores what matters, and delivers a weekly brief with same-day alerts.",
};

const PIPELINE = [
  {
    icon: Globe,
    step: "01",
    title: "Deep research, both directions",
    description:
      "Claude-powered research searches the live web for each competitor — and for your own brand via Brand Pulse. Every finding carries its sources, so you can verify the evidence behind every claim.",
  },
  {
    icon: GitCompareArrows,
    step: "02",
    title: "Delta detection",
    description:
      "Each new research run is compared against the previous one. Only genuine changes surface — a pricing shift, a funding round, a hiring spike — not a re-hash of what you already knew.",
  },
  {
    icon: Gauge,
    step: "03",
    title: "Significance scoring",
    description:
      "Every change is scored 1–10 for strategic significance, with impact analysis of what the move means for your position. Routine noise scores low; strategic moves score high.",
  },
  {
    icon: Send,
    step: "04",
    title: "Delivery where you work",
    description:
      "A curated strategic brief lands every Monday. High-significance changes (7+) trigger an email the same day we detect them. Slack and webhook delivery are available on higher tiers.",
  },
];

const CATEGORIES = [
  { icon: Newspaper, label: "News & media", detail: "Press, coverage, announcements" },
  { icon: Rocket, label: "Product", detail: "Launches, features, pricing changes" },
  { icon: Banknote, label: "Funding", detail: "Rounds, investors, financial signals" },
  { icon: Users, label: "Hiring", detail: "Roles, teams, expansion signals" },
  { icon: MessageSquare, label: "Social", detail: "Sentiment and engagement shifts" },
  {
    icon: Factory,
    label: "Industry lens",
    detail: "A sixth category tuned to your industry — e.g. regulatory moves for fintech",
  },
];

const SIGNALS = [
  {
    icon: TrendingUp,
    title: "Momentum",
    description:
      "Rule-based direction of each company's activity — rising, stable, slowing, or declining — computed from the last two weeks of detected changes. Your own brand gets one too.",
  },
  {
    icon: ShieldAlert,
    title: "Threat level",
    description:
      "AI-assigned against a fixed rubric, from monitor to critical, with a written rationale. Deliberately never scored for your own brand — Kironyx doesn't treat you as your own enemy.",
  },
  {
    icon: Tags,
    title: "Strategic tags",
    description:
      "Derived posture chips like just-raised, hiring-aggressively, or going-upmarket, computed from each research cycle so you can read a competitor's direction at a glance.",
  },
];

const DELIVERY = [
  { icon: Mail, label: "Monday strategic digest", note: "every plan" },
  { icon: Bell, label: "Same-day alerts at significance 7+", note: "every plan" },
  { icon: Slack, label: "Slack + webhook delivery", note: "Strategist and up" },
  { icon: FileText, label: "Battlecards + PDF / CSV exports", note: "tier-gated" },
  { icon: Code2, label: "Read/write API access", note: "Strategist and up" },
];

export default function ProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Product"
        title={
          <>
            One research engine,{" "}
            <span className="text-gradient-primary">pointed both ways</span>
          </>
        }
        description="Kironyx runs the same AI deep research on your competitors and on your own brand, then benchmarks the two — so every insight arrives with 'and here's where you stand.'"
      >
        <Button
          asChild
          size="lg"
          className="bg-cta px-8 text-obsidian-950 shadow-lg shadow-cta/20 transition-all hover:bg-cta-hover active:scale-[0.98]"
        >
          <Link href="/sign-up">Start Free Trial</Link>
        </Button>
      </PageHero>

      {/* Pipeline */}
      <section className="border-t border-ink/[0.06] bg-obsidian-900/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
              From raw web to weekly brief
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((item, index) => (
              <Reveal key={item.step} delay={index * 60}>
                <Card className="h-full border-ink/[0.08] bg-obsidian-900 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <item.icon className="h-7 w-7 text-primary" />
                      <span className="font-mono text-xs text-ink/45">{item.step}</span>
                    </div>
                    <h3 className="mt-4 font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/70">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="text-center">
              <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
                What the research covers
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-ink/70">
                Five intelligence categories on every tracked company, plus an
                industry-aware sixth lens when you tell Kironyx your industry.
              </p>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((category, index) => (
              <Reveal key={category.label} delay={(index % 3) * 60}>
                <div className="flex h-full items-start gap-3 rounded-lg border border-ink/[0.08] bg-obsidian-900 p-4 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
                  <category.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">{category.label}</p>
                    <p className="mt-1 text-sm text-ink/70">{category.detail}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Pulse */}
      <section className="border-t border-ink/[0.06] bg-obsidian-900/40 px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-primary/80">
                Brand Pulse
              </p>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
                The mirror is the product
              </h2>
              <p className="mt-4 text-[17px] leading-[1.65] text-ink/70">
                Most tools only watch the other side. Kironyx runs the identical
                deep research on your own brand — coverage, sentiment, share of
                voice — and benchmarks it against your competitive set. Brand
                Health condenses it into one score; Share of Voice ranks you
                honestly among your rivals; the comparison matrix pins you as
                the reference line.
              </p>
              <p className="mt-4 text-[17px] leading-[1.65] text-ink/70">
                Brand Pulse is included on every plan, because a competitive
                picture without you in it is only half a picture.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="rounded-lg border border-ink/[0.08] bg-obsidian-900 p-6 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]" aria-hidden>
              <p className="text-sm font-medium">
                Share of Voice{" "}
                <span className="font-normal text-ink/55">· illustrative</span>
              </p>
              <div className="mt-4 space-y-3">
                {[
                  { name: "You", pct: 34, cls: "bg-primary", self: true },
                  { name: "Acme Analytics", pct: 28, cls: "bg-blue-500" },
                  { name: "Northwind", pct: 22, cls: "bg-blue-500/70" },
                  { name: "BoldMetrics", pct: 16, cls: "bg-blue-500/40" },
                ].map((row) => (
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
                    <span className="w-8 text-right text-xs tabular-nums text-ink/55">
                      {row.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Derived signals */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="text-center">
              <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
                Signals, not just headlines
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-ink/70">
                Every research cycle updates derived intelligence on each tracked
                company. The scoring rubrics are published in full on the
                in-app methodology page.
              </p>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {SIGNALS.map((signal, index) => (
              <Reveal key={signal.title} delay={index * 60}>
                <Card className="h-full border-ink/[0.08] bg-obsidian-900 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
                  <CardContent className="p-6">
                    <signal.icon className="h-7 w-7 text-primary" />
                    <h3 className="mt-4 font-semibold">{signal.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/70">
                      {signal.description}
                    </p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Delivery */}
      <section className="border-t border-ink/[0.06] bg-obsidian-900/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
              Delivered where you already work
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <ul className="mt-10 divide-y divide-ink/[0.06] rounded-lg border border-ink/[0.08] bg-obsidian-900 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
              {DELIVERY.map((item) => (
                <li key={item.label} className="flex items-center gap-3 px-5 py-4">
                  <item.icon className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm">{item.label}</span>
                  <span className="ml-auto font-mono text-xs uppercase tracking-[0.08em] text-ink/45">
                    {item.note}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 text-center text-sm text-ink/55">
              Want to see the output first?{" "}
              <Link href="/sample-report" className="text-primary hover:underline">
                Read a sample report
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </section>

      <FooterCTASection />
    </>
  );
}
