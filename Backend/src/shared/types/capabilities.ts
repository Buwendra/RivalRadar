/**
 * Tier capability matrix (Phase 6).
 *
 * Source of truth for "what does each plan unlock" — qualitative differences
 * between Scout / Strategist / Command, not just count limits. Replaces
 * direct `PLAN_LIMITS[tier].*` reads for any new gating; existing PLAN_LIMITS
 * call sites stay during transition.
 *
 * Pattern:
 *   import { hasCapability } from '@shared/utils/capability';
 *   if (!hasCapability(user, 'csvExports')) throw new HttpError(403, ...);
 *
 * Frontend mirrors this in `Frontend/src/lib/utils/capabilities.ts` (kept
 * in sync manually — single small file).
 *
 * `recommendations.maxVisible: -1` = unlimited (Command). `seats.max` is
 * forward-looking for Phase 4 (workspaces); harmless to publish now.
 */

import type { PlanTier } from './index';

export interface Capabilities {
  /** PDF export of weekly briefing. Phase 6b will ship the actual handler. */
  pdfExports: boolean;
  /** CSV export of changes / competitors / recommendations. */
  csvExports: boolean;
  /** Slack incoming-webhook integration. */
  slackIntegration: boolean;
  /** Generic HMAC-signed webhook integration. */
  webhookIntegration: boolean;
  /** Predicted next moves card on competitor detail. */
  predictedMoves: boolean;
  /** Recommended actions card on dashboard. */
  recommendations: {
    /** -1 = unlimited */
    maxVisible: number;
  };
  /** Custom recommendation focus areas (Command exclusive — Phase 6a). */
  customRecommendationCategories: boolean;
  /** Scheduled report email subscriptions (Phase 6b). */
  scheduledReports: boolean;
  /** Multi-seat workspace (Phase 4). */
  seats: {
    /** -1 = unlimited */
    max: number;
  };
  /** Saved filter views (Phase 7b). 0 = feature locked. */
  savedViews: {
    max: number;
  };
  /** Public API access (Phase 11). False = no /v1/* requests, no key minting. */
  apiAccess: boolean;
  /** Maximum concurrent API keys per workspace (Phase 11). 0 = locked. */
  apiKeys: {
    max: number;
  };
  /** Cross-competitor comparison matrix (Phase 19). */
  comparatorMatrix: boolean;
}

export const CAPABILITIES: Record<PlanTier, Capabilities> = {
  scout: {
    pdfExports: false,
    csvExports: false,
    slackIntegration: false,
    webhookIntegration: false,
    predictedMoves: true, // available all tiers — Phase 6 doesn't gate
    recommendations: { maxVisible: 3 },
    customRecommendationCategories: false,
    scheduledReports: false,
    seats: { max: 1 },
    savedViews: { max: 0 },
    apiAccess: false,
    apiKeys: { max: 0 },
    comparatorMatrix: false,
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
  },
};
