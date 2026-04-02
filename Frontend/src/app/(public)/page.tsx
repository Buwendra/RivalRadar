import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQSection } from "@/components/landing/faq-section";
import { FooterCTASection } from "@/components/landing/footer-cta-section";

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
