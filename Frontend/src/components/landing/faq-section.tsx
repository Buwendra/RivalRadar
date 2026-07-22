import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How does Kironyx detect changes?",
    answer:
      "Kironyx runs Claude-powered deep web research on each competitor, searching the live web across news, product, funding, hiring, and social signals. Each new research run is compared against the previous one to surface meaningful changes — from pricing updates to feature launches — with the supporting sources cited alongside every finding.",
  },
  {
    question: "Do you monitor my own brand too?",
    answer:
      "Yes — Brand Pulse is included on every plan. The same deep-research engine that tracks your competitors runs on your own brand, giving you a coverage feed, a sentiment trend, a Brand Health Score, and your share of voice ranked honestly alongside the competitors you track. It also powers the opt-in weekly Comparative Brief that shows exactly where you stand.",
  },
  {
    question: "How accurate is the AI analysis?",
    answer:
      "Our analysis is powered by Claude AI from Anthropic. Each detected change is scored with a structured framework that identifies change type, a significance score (1-10), strategic implications, and recommended actions. Every finding links back to the web sources it was drawn from, so you can always verify the underlying evidence.",
  },
  {
    question: "What can I monitor?",
    answer:
      "Kironyx tracks each competitor across five intelligence categories — news, product, funding, hiring, and social — plus derived signals like momentum, threat level, and strategic direction. And it's not just them: Brand Pulse runs the same research on your own brand, so every competitor view comes with a benchmark.",
  },
  {
    question: "How is this different from Google Alerts?",
    answer:
      "Google Alerts just forwards keyword matches. Kironyx actively researches each competitor across the web, analyzes the strategic significance of what it finds, and delivers a scored, cited briefing — surfacing pricing shifts, funding events, and hiring signals you'd otherwise miss, not just raw notifications.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, absolutely. All plans are month-to-month with no long-term contracts. You can upgrade, downgrade, or cancel at any time through your billing settings. If you cancel, you'll retain access through the end of your current billing period.",
  },
  {
    question: "How quickly will I see my first insights?",
    answer:
      "After completing the 2-minute onboarding wizard, Kironyx immediately kicks off deep research on each competitor you added. Your first cited findings land within minutes, and research re-runs on a recurring schedule (or on demand) to keep your competitive picture current.",
  },
];

export function FAQSection() {
  return (
    <section className="border-t border-ink/[0.06] bg-obsidian-900/40 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-4xl">
          Fair questions
        </h2>

        <Accordion type="single" collapsible className="mt-10">
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
      </div>
    </section>
  );
}
