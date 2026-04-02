import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Scout",
    price: 49,
    description: "For founders keeping an eye on the competition.",
    features: [
      "3 competitors",
      "Weekly strategic digest",
      "Dashboard access",
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
      "10 competitors",
      "Daily strategic digests",
      "Slack alerts",
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
      "25 competitors",
      "Real-time alerts",
      "API access",
      "1-year change history",
      "Custom analysis prompts",
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
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-muted-foreground">
              Enterprise-grade intelligence without the enterprise price tag.
              Cancel anytime.
            </p>
          </div>
        )}

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                "relative border-brand-700 bg-brand-900",
                plan.popular && "border-primary shadow-lg shadow-primary/10"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground">
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
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-significance-low" />
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
          ))}
        </div>
      </div>
    </section>
  );
}
