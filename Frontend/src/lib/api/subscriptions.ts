import { apiClient } from "./client";
import type { Subscription, PlanTier } from "@/lib/types";

export const subscriptionsApi = {
  getCurrent: () => apiClient<Subscription>("/subscriptions/me"),

  checkout: (plan: PlanTier) =>
    apiClient<{ checkoutUrl: string }>("/subscriptions/checkout", {
      method: "POST",
      body: { plan },
    }),

  portal: () =>
    apiClient<{ portalUrl: string }>("/subscriptions/portal", {
      method: "POST",
    }),
};
