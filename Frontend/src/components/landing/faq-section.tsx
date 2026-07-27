import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dateline } from "@/components/marketing/editorial";

const faqs = [
  {
    question: "Do you monitor my own brand too?",
    answer:
      "Yes — this is the whole point, and it's on every plan. The same deep-research engine that tracks your competitors runs on your own brand, giving you a coverage feed, a sentiment trend, a Brand Health Score, and your share of voice ranked honestly alongside the competitors you track. Every competitor view arrives with a benchmark.",
  },
  {
    question: "How does Kironyx detect changes?",
    answer:
      "It runs Claude-powered deep web research on each company — yours and your competitors' — across news, product, funding, hiring, and social signals. Each run is compared against the previous one to surface meaningful changes, from pricing shifts to feature launches, with the supporting sources cited alongside every finding.",
  },
  {
    question: "How accurate is the AI analysis?",
    answer:
      "The analysis is powered by Claude from Anthropic. Each detected change is scored with a structured framework — change type, a significance score (1–10), strategic implications, and recommended actions. Every finding links back to the web sources it was drawn from, so you can always verify the evidence. It's AI-assisted; check the sources before you act.",
  },
  {
    question: "How is this different from Google Alerts?",
    answer:
      "Google Alerts forwards keyword matches. Kironyx actively researches each company across the web, scores the strategic significance of what it finds, and delivers a cited briefing that puts you and the field side by side — surfacing pricing shifts, funding, and hiring signals you'd otherwise miss, not just raw notifications.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. All plans are month-to-month with no long-term contract. You can upgrade, downgrade, or cancel at any time through billing settings, and you keep access through the end of your current period.",
  },
  {
    question: "How quickly will I see my first brief?",
    answer:
      "Once your workspace is set up, Kironyx immediately kicks off deep research on each competitor you added and on your own brand. Your first cited findings land within minutes, and research re-runs on a recurring schedule — or on demand — to keep the picture current.",
  },
];

export function FAQSection() {
  return (
    <section className="border-t border-ink/[0.08] bg-obsidian-900/40 px-6 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[5fr_7fr] md:gap-16">
        <div className="md:sticky md:top-28 md:self-start">
          <Dateline>Questions</Dateline>
          <h2 className="mt-6 font-display text-display-m font-medium">
            Fair questions.
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`faq-${index}`}
              className="border-ink/[0.08]"
            >
              <AccordionTrigger className="py-5 text-left font-display text-title text-foreground hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-body-lg leading-relaxed text-muted-foreground measure">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
