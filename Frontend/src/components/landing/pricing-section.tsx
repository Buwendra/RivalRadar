import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_CTA_HREF, primaryCtaLabel } from "@/lib/utils/signup-flag";

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
    cta: "Start free trial",
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
    cta: "Start free trial",
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
    cta: "Start free trial",
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
            <h2 className="font-display text-display-m font-medium">
              Three plans, no sales call
            </h2>
            <p className="mt-4 text-body-lg text-muted-foreground">
              Transparent monthly pricing, cancel whenever. Brand Pulse
              self-monitoring is on every plan — your own brand is never the
              paywalled part.
            </p>
          </div>
        )}

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className="relative">
              {plan.popular && (
                <div
                  className="pointer-events-none absolute -inset-px rounded-lg bg-primary/15 blur-md"
                  aria-hidden
                />
              )}
              <Card
                className={cn(
                  "relative h-full border-ink/[0.08] bg-obsidian-900 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)] transition-colors duration-200 hover:border-ink/[0.16]",
                  plan.popular &&
                    "border-primary/60 hover:border-primary/60"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground">
                    Most teams pick this
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
                      "w-full transition-[transform,background-color] duration-150 ease-out-strong active:scale-[0.98]",
                      plan.popular
                        ? "bg-cta text-obsidian-950 hover:bg-cta-hover"
                        : ""
                    )}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    <Link href={PRIMARY_CTA_HREF}>{primaryCtaLabel(plan.cta)}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
