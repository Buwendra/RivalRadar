import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQSection } from "@/components/landing/faq-section";
import { FooterCTASection } from "@/components/landing/footer-cta-section";

export const metadata: Metadata = {
  description:
    "Kironyx runs the same AI deep research on your competitors and your own brand, then files the gap between them — where you lead, where you're exposed — in one brief every Monday.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: "Kironyx — your brand and your rivals, seen through one lens",
  },
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesSection />
      <PricingSection />
      <FAQSection />
      <FooterCTASection />
    </>
  );
}
