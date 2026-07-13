import type { Metadata } from "next";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQSection } from "@/components/landing/faq-section";
import { FooterCTASection } from "@/components/landing/footer-cta-section";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for competitive intelligence + brand monitoring in one. Brand Pulse self-monitoring on every plan. Plans starting at $49/month.",
};

export default function PricingPage() {
  return (
    <>
      <section className="px-4 pt-20 text-center sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Competitive intelligence and brand monitoring in one, without the
          enterprise price tag. Brand Pulse self-monitoring is included on
          every plan. Start free, upgrade as you grow.
        </p>
      </section>
      <PricingSection showHeading={false} />
      <FAQSection />
      <FooterCTASection />
    </>
  );
}
