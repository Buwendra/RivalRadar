"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { subscriptionsApi } from "@/lib/api/subscriptions";
import type { PlanTier } from "@/lib/types";

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () => subscriptionsApi.getCurrent(),
    staleTime: 60_000,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (plan: PlanTier) => subscriptionsApi.checkout(plan),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: () => subscriptionsApi.portal(),
    onSuccess: (data) => {
      window.open(data.portalUrl, "_blank");
    },
  });
}
