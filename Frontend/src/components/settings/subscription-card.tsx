"use client";

import { useSubscription, useBillingPortal } from "@/lib/hooks/use-subscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PLAN_LIMITS } from "@/lib/utils/plan-limits";
import { PLAN_PRICES } from "@/lib/utils/constants";
import { formatSmartDate } from "@/lib/utils/format-date";

export function SubscriptionCard() {
  const { data: subscription, isLoading } = useSubscription();
  const billingPortal = useBillingPortal();

  if (isLoading) {
    return <Skeleton className="h-48 w-full bg-brand-800" />;
  }

  const plan = subscription?.plan ?? "scout";
  const limits = PLAN_LIMITS[plan];
  const price = PLAN_PRICES[plan];

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Your current plan and billing</CardDescription>
          </div>
          <Badge
            variant={subscription?.status === "active" ? "default" : "secondary"}
            className="capitalize"
          >
            {subscription?.status ?? "free"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold capitalize">{plan}</span>
          <span className="text-muted-foreground">${price}/mo</span>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Up to {limits.maxCompetitors} competitors</p>
          <p>{limits.historyDays}-day change history</p>
          {subscription?.currentPeriodEnd && (
            <p>Renews {formatSmartDate(subscription.currentPeriodEnd)}</p>
          )}
        </div>

        {subscription?.status !== "free" && (
          <Button
            variant="outline"
            onClick={() => billingPortal.mutate()}
            disabled={billingPortal.isPending}
          >
            {billingPortal.isPending && <LoadingSpinner size="sm" className="mr-2" />}
            Manage Billing
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
