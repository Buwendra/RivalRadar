import type { Metadata } from "next";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQSection } from "@/components/landing/faq-section";
import { FooterCTASection } from "@/components/landing/footer-cta-section";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Transparent monthly pricing for the both-directions intelligence brief: your competitors and your own brand in one engine. Brand Pulse self-monitoring on every plan. From $49/month.",
};

export default function PricingPage() {
  return (
    <>
      {/* Deliberately calm — no signal field. A pricing page should read as
          steady and legible, not animated. */}
      <section className="px-6 pb-4 pt-20 text-center sm:px-8 sm:pt-28">
        <div className="mx-auto flex max-w-fit items-center gap-3 font-mono text-label uppercase text-muted-foreground">
          <span aria-hidden className="h-px w-6 bg-foreground/30" />
          <span>Pricing</span>
          <span aria-hidden className="h-px w-6 bg-foreground/30" />
        </div>
        <h1 className="mx-auto mt-6 max-w-2xl font-display text-display-l font-medium">
          Priced for the teams doing the work.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-standfirst text-muted-foreground">
          Your competitors and your own brand, in one engine, without the
          enterprise price tag. Brand Pulse self-monitoring is on every plan;
          your own side is never the paywalled part.
        </p>
      </section>
      <PricingSection showHeading={false} />
      <FAQSection />
      <FooterCTASection />
    </>
  );
}
