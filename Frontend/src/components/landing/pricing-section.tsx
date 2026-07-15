import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

const plans = [
  {
    name: "Scout",
    price: 49,
    description: "See where you stand against your first competitors.",
    features: [
      "Stay ahead of 3 competitors — benchmarked against your own brand",
      "Brand Pulse self-monitoring included",
      "Weekly strategic digest",
      "30-day change history",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Strategist",
    price: 99,
    description: "For teams that compete to win every deal.",
    features: [
      "Stay ahead of 10 competitors — and see the gap on each",
      "Brand Pulse self-monitoring included",
      "Weekly strategic digest + audio briefing",
      "Side-by-side comparison matrix — with you in it",
      "Slack alerts + API access",
      "90-day change history",
      "Battlecard templates",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Command",
    price: 199,
    description: "For organizations that dominate their market.",
    features: [
      "Stay ahead of 25 competitors — the full field, benchmarked",
      "Brand Pulse self-monitoring included",
      "Monthly executive PDF briefings",
      "Custom analysis focus areas",
      "1-year change history",
      "Dedicated support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
];

interface PricingSectionProps {
  showHeading?: boolean;
}

export function PricingSection({ showHeading = true }: PricingSectionProps) {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {showHeading && (
          <Reveal>
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mt-4 text-muted-foreground">
                Competitive intelligence + brand monitoring in one, without the
                enterprise price tag. Cancel anytime.
              </p>
            </div>
          </Reveal>
        )}

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 120} className="relative">
              {plan.popular && (
                <div
                  className="pointer-events-none absolute -inset-px animate-glow-pulse rounded-lg bg-primary/20 blur-md"
                  aria-hidden
                />
              )}
              <Card
                className={cn(
                  "relative h-full border-brand-700 bg-brand-900 transition-all duration-300 hover:-translate-y-1 hover:border-brand-600",
                  plan.popular &&
                    "border-primary shadow-lg shadow-primary/10 hover:border-primary hover:shadow-primary/20"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground shadow-md shadow-primary/40">
                    Most Popular
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-significance-low" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className={cn(
                      "w-full",
                      plan.popular
                        ? "bg-cta text-brand-950 hover:bg-cta-hover"
                        : ""
                    )}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    <Link href="/sign-up">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
