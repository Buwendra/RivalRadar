import Link from "next/link";
import { Check, Minus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/landing/reveal";
import { FooterCTASection } from "@/components/landing/footer-cta-section";
import { PRIMARY_CTA_HREF, primaryCtaLabel } from "@/lib/utils/signup-flag";

export interface CompareRow {
  label: string;
  kironyx: string;
  competitor: string;
  kironyxWins: boolean;
}

export interface CompareTemplateProps {
  competitorName: string;
  eyebrow: string;
  title: React.ReactNode;
  intro: string;
  rows: CompareRow[];
  whereWeWin: { title: string; description: string }[];
  whenTheyWin: { intro: string; items: string[] };
  faqs: { question: string; answer: string }[];
}

/** Shared layout for the honest "X alternative" comparison pages. */
export function CompareTemplate({
  competitorName,
  eyebrow,
  title,
  intro,
  rows,
  whereWeWin,
  whenTheyWin,
  faqs,
}: CompareTemplateProps) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={intro}>
        <Button
          asChild
          size="lg"
          className="group bg-cta px-8 text-obsidian-950 shadow-lg shadow-cta/20 transition-[transform,background-color,box-shadow] duration-150 ease-out-strong hover:bg-cta-hover hover:shadow-cta/30 active:scale-[0.97]"
        >
          <Link href={PRIMARY_CTA_HREF}>
            {primaryCtaLabel("Try Kironyx free")}
            <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-150 ease-out-strong group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </PageHero>

      {/* Comparison table */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <div className="overflow-x-auto rounded-xl border border-ink/10 shadow-[inset_0_1px_0_rgba(225,217,193,0.08)]">
              <table className="w-full min-w-[560px] border-collapse bg-obsidian-900 text-sm">
                <thead>
                  <tr className="border-b border-ink/[0.08] bg-obsidian-950/60 text-left">
                    <th className="px-5 py-4 font-mono text-label uppercase text-ink/55" />
                    <th className="px-5 py-4 font-semibold text-foreground">Kironyx</th>
                    <th className="px-5 py-4 font-medium text-ink/70">
                      {competitorName}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/[0.06]">
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-5 py-4 font-medium text-ink/75">{row.label}</td>
                      <td className="px-5 py-4 text-ink/85">
                        <span className="flex items-start gap-2">
                          {row.kironyxWins && (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-significance-low" />
                          )}
                          {row.kironyx}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-ink/55">
                        <span className="flex items-start gap-2">
                          {!row.kironyxWins && (
                            <Minus className="mt-0.5 h-4 w-4 shrink-0 text-ink/35" />
                          )}
                          {row.competitor}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-4 text-center text-xs text-ink/45">
              Comparison reflects publicly available information about{" "}
              {competitorName} as of July 2026 and may change — verify current
              details with the vendor.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Where Kironyx wins */}
      <section className="border-t border-ink/[0.06] bg-obsidian-900/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="text-center font-display text-display-m font-medium">
              Where Kironyx wins
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {whereWeWin.map((item, index) => (
              <Reveal key={item.title} delay={index * 60}>
                <Card className="h-full border-ink/[0.08] bg-obsidian-900 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
                  <CardContent className="p-6">
                    <h3 className="font-semibold">{item.title}</h3>
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

      {/* Honest counter-recommendation */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="rounded-xl border border-ink/10 bg-obsidian-900 p-8 shadow-[inset_0_1px_0_rgba(225,217,193,0.08)]">
              <h2 className="font-display text-headline font-medium">
                When {competitorName} is the better choice
              </h2>
              <p className="mt-3 text-[17px] leading-[1.65] text-ink/70">{whenTheyWin.intro}</p>
              <ul className="mt-4 space-y-2">
                {whenTheyWin.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink/75">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm leading-relaxed text-ink/55">
                We&apos;d rather you pick the right tool than churn out of the
                wrong one. If that&apos;s you, {competitorName} is genuinely
                good at what it does.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-ink/[0.06] bg-obsidian-900/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-center font-display text-display-m font-medium">
              Frequently asked questions
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <Accordion type="single" collapsible className="mt-12">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="border-ink/[0.08] transition-colors hover:border-ink/[0.16]"
                >
                  <AccordionTrigger className="text-left hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      <FooterCTASection />
    </>
  );
}
