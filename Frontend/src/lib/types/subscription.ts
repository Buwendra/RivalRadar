export type PlanTier = "scout" | "strategist" | "command";

export interface Subscription {
  plan: PlanTier;
  status: "active" | "canceled" | "past_due" | "trialing" | "paused" | "free";
  currentPeriodEnd?: string;
  paddleSubscriptionId?: string;
  message?: string;
}
