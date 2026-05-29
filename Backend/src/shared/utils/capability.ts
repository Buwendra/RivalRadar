import { CAPABILITIES, type Capabilities } from '../types/capabilities';
import type { PlanTier, User } from '../types';

/**
 * Resolve the effective capabilities for a user. Returns the plan-tier
 * defaults today; once Phase 4 (workspaces) lands this becomes
 * `(workspace) => CAPABILITIES[workspace.plan]`. Handlers should always
 * call this rather than indexing CAPABILITIES directly so the future
 * workspace-aware lookup is a single-file swap.
 */
export function capabilitiesFor(user: Pick<User, 'plan'> | undefined): Capabilities {
  const plan: PlanTier = user?.plan ?? 'scout';
  return CAPABILITIES[plan];
}

/**
 * Boolean capability check. Use for routes that should hard-error on access
 * (e.g. CSV export). For numeric capacity capabilities (`recommendations.maxVisible`)
 * read the value directly from `capabilitiesFor(user)`.
 */
export function hasCapability(
  user: Pick<User, 'plan'> | undefined,
  capability:
    | 'pdfExports'
    | 'csvExports'
    | 'slackIntegration'
    | 'webhookIntegration'
    | 'predictedMoves'
    | 'customRecommendationCategories'
    | 'scheduledReports'
    | 'apiAccess'
    | 'comparatorMatrix'
    | 'brandPulse'
    | 'audioBriefing'
): boolean {
  const caps = capabilitiesFor(user);
  return caps[capability] === true;
}
