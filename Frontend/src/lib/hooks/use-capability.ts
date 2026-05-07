"use client";

import { useAuth } from "@/lib/auth/use-auth";
import { CAPABILITIES, type Capabilities } from "@/lib/utils/capabilities";
import type { PlanTier } from "@/lib/types";

/**
 * Resolve the current user's capabilities object. Returns the Scout default
 * if the user record hasn't loaded yet, so the UI degrades to "free tier"
 * during auth hydration rather than flashing premium UI.
 */
export function useCapabilities(): Capabilities {
  const { user } = useAuth();
  const tier: PlanTier = user?.plan ?? "scout";
  return CAPABILITIES[tier];
}

/**
 * Boolean capability check. Hides UI for unentitled tiers; backend still
 * enforces. For numeric capacity (`recommendations.maxVisible`) read the
 * value from `useCapabilities()` directly.
 */
export function useCapability(
  capability:
    | "pdfExports"
    | "csvExports"
    | "slackIntegration"
    | "webhookIntegration"
    | "predictedMoves"
    | "customRecommendationCategories"
    | "scheduledReports"
    | "apiAccess"
    | "comparatorMatrix"
): boolean {
  const caps = useCapabilities();
  return caps[capability] === true;
}
