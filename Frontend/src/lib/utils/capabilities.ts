/**
 * Mirror of `Backend/src/shared/types/capabilities.ts`. Keep these two files
 * in lock-step when adding new capabilities. Backend remains the enforcement
 * source of truth — frontend uses this only for UI gating (showing/hiding
 * upgrade prompts, disabling buttons).
 */

import type { PlanTier } from "@/lib/types";

export interface Capabilities {
  pdfExports: boolean;
  csvExports: boolean;
  slackIntegration: boolean;
  webhookIntegration: boolean;
  predictedMoves: boolean;
  recommendations: { maxVisible: number };
  customRecommendationCategories: boolean;
  scheduledReports: boolean;
  seats: { max: number };
  savedViews: { max: number };
  apiAccess: boolean;
  apiKeys: { max: number };
  comparatorMatrix: boolean;
  /** Phase 23 — Brand Pulse: self-brand monitoring. Available on all tiers. */
  brandPulse: boolean;
}

export const CAPABILITIES: Record<PlanTier, Capabilities> = {
  scout: {
    pdfExports: false,
    csvExports: false,
    slackIntegration: false,
    webhookIntegration: false,
    predictedMoves: true,
    recommendations: { maxVisible: 3 },
    customRecommendationCategories: false,
    scheduledReports: false,
    seats: { max: 1 },
    savedViews: { max: 0 },
    apiAccess: false,
    apiKeys: { max: 0 },
    comparatorMatrix: false,
    brandPulse: true,
  },
  strategist: {
    pdfExports: true,
    csvExports: true,
    slackIntegration: true,
    webhookIntegration: true,
    predictedMoves: true,
    recommendations: { maxVisible: 10 },
    customRecommendationCategories: false,
    scheduledReports: false,
    seats: { max: 5 },
    savedViews: { max: 5 },
    apiAccess: true,
    apiKeys: { max: 5 },
    comparatorMatrix: true,
    brandPulse: true,
  },
  command: {
    pdfExports: true,
    csvExports: true,
    slackIntegration: true,
    webhookIntegration: true,
    predictedMoves: true,
    recommendations: { maxVisible: -1 },
    customRecommendationCategories: true,
    scheduledReports: true,
    seats: { max: 25 },
    savedViews: { max: 25 },
    apiAccess: true,
    apiKeys: { max: 25 },
    comparatorMatrix: true,
    brandPulse: true,
  },
};

export function capabilitiesFor(user: { plan?: PlanTier } | null | undefined): Capabilities {
  return CAPABILITIES[user?.plan ?? "scout"];
}
