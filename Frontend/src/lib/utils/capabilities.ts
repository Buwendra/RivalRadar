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
  },
};
