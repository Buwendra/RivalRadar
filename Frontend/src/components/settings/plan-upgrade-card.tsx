"use client";

import { useAuth } from "@/lib/auth/use-auth";
import { useCheckout } from "@/lib/hooks/use-subscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PLAN_PRICES } from "@/lib/utils/constants";
import type { PlanTier } from "@/lib/types";
import { cn } from "@/lib/utils";

const PLANS: Array<{
  tier: PlanTier;
  name: string;
  features: string[];
  popular?: boolean;
}> = [
  {
    tier: "scout",
    name: "Scout",
    features: ["3 competitors", "Weekly digest", "30-day history", "Dashboard access"],
  },
  {
    tier: "strategist",
    name: "Strategist",
    popular: true,
    features: [
      "10 competitors",
      "Daily digests",
      "Slack alerts",
      "90-day history",
      "Battlecard templates",
    ],
  },
  {
    tier: "command",
    name: "Command",
    features: [
      "25 competitors",
      "Real-time alerts",
      "API access",
      "1-year history",
      "Custom analysis prompts",
      "Priority support",
    ],
  },
];

export function PlanUpgradeCard() {
  const { user } = useAuth();
  const checkout = useCheckout();
  const currentPlan = user?.plan ?? "scout";

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle>Change Plan</CardTitle>
        <CardDescription>Upgrade or downgrade your subscription</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.tier === currentPlan;
            return (
              <div
                key={plan.tier}
                className={cn(
                  "rounded-lg border p-4",
                  plan.popular ? "border-primary" : "border-brand-700",
                  isCurrent && "bg-brand-800"
                )}
              >
                {plan.popular && (
                  <p className="mb-2 text-xs font-medium text-primary">Most Popular</p>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 text-2xl font-bold">
                  ${PLAN_PRICES[plan.tier]}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3 w-3 text-significance-low" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn(
                    "mt-4 w-full",
                    plan.popular && !isCurrent && "bg-cta text-brand-950 hover:bg-cta-hover"
                  )}
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || checkout.isPending}
                  onClick={() => checkout.mutate(plan.tier)}
                >
                  {checkout.isPending ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : null}
                  {isCurrent ? "Current Plan" : "Select Plan"}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
