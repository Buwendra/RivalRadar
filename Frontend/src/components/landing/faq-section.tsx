import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How does RivalScan detect changes?",
    answer:
      "We use Firecrawl to scrape your competitor websites daily, converting them to structured content. Our AI then compares each new version against the previous snapshot using advanced diff analysis to detect meaningful changes — from pricing updates to feature launches.",
  },
  {
    question: "How accurate is the AI analysis?",
    answer:
      "Our analysis is powered by Claude AI from Anthropic. Each change is analyzed with a structured framework that identifies change type, significance score (1-10), strategic implications, and recommended actions. We also always show the raw diff alongside the AI analysis so you can verify.",
  },
  {
    question: "What types of pages can I monitor?",
    answer:
      "You can track pricing pages, feature/product pages, homepages, blogs, and careers/job listing pages for each competitor. This gives you a comprehensive view of their strategic moves — from pricing changes to hiring signals.",
  },
  {
    question: "How is this different from Google Alerts?",
    answer:
      "Google Alerts only catches publicly indexed content and often misses subtle changes like pricing tweaks or feature updates. RivalScan directly monitors specific pages daily and uses AI to analyze the strategic significance of each change, delivering actionable insights — not just notifications.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, absolutely. All plans are month-to-month with no long-term contracts. You can upgrade, downgrade, or cancel at any time through your billing settings. If you cancel, you'll retain access through the end of your current billing period.",
  },
  {
    question: "How quickly will I see my first insights?",
    answer:
      "After completing the 2-minute onboarding wizard, we immediately scrape your competitors. You'll see your first competitor snapshots within minutes. Meaningful change detection begins the next day when we compare against the initial baseline.",
  },
];

export function FAQSection() {
  return (
    <section className="border-t border-brand-700 bg-brand-900/50 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-12">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`faq-${index}`} className="border-brand-700">
              <AccordionTrigger className="text-left hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
