/**
 * Research-eligibility orchestrator (Phase 1 misuse defense).
 *
 * Sequence:
 *   1. Account-status check  (status === 'active'  required)
 *   2. Sanctions denylist    (sync, deterministic)
 *   3. Rate limit            (atomic-ish read-modify-write on User row)
 *   4. Haiku classifier      (fail-CLOSED on errors)
 *
 * Returns { allowed: true } on success, with the new researchCountDay so the
 * caller can echo it to the user. Returns { allowed: false, ... } with a
 * specific code on rejection so handlers can map to user-facing 400/403/429.
 */
import { classifyResearchTarget } from '../services/anthropic';
import { updateItem } from '../db/queries';
import { userPK, userSK } from '../db/keys';
import { logger } from './logger';
import { checkSanctions } from './sanctions';
import { PLAN_LIMITS, type PlanTier } from '../types';
import type { User, AccountStatus } from '../types/user';

export type IneligibilityCode =
  | 'ACCOUNT_RESTRICTED'
  | 'ACCOUNT_PENDING_DELETION'
  | 'SANCTIONED_TARGET'
  | 'PERSONAL_NAME_PATTERN'
  | 'INDIVIDUAL_PERSON_TARGET'
  | 'NON_COMMERCIAL_TARGET'
  | 'PROTECTED_GROUP_TARGET'
  | 'CLASSIFIER_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'COST_CAP_EXCEEDED';

export interface EligibilityResult {
  allowed: boolean;
  code?: IneligibilityCode;
  reason?: string;
  rateLimitInfo?: {
    used: number;
    limit: number;
    resetAt: string;
  };
  costCapInfo?: {
    monthToDateCostUsd: number;
    capUsd: number;
    month: string;
  };
}

/** UTC midnight after the given timestamp, as ISO string. */
function nextUtcMidnight(now: Date): string {
  const next = new Date(now);
  next.setUTCHours(0, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

/**
 * Atomic-ish read-then-conditional-write rate-limit increment. The race
 * window between read and write is one Lambda invocation (<1s); the worst
 * case is one user getting one extra research call beyond their limit, which
 * is benign for MVP. If we ever need true atomicity, swap in a DynamoDB
 * UpdateCommand with `ConditionExpression: counter < :limit` + ADD.
 */
async function incrementRateLimit(
  user: User & Record<string, unknown>,
  count: number
): Promise<{ ok: true; nextUsed: number; resetAt: string } | { ok: false; used: number; limit: number; resetAt: string }> {
  const tier: PlanTier = user.plan ?? 'scout';
  const limit = PLAN_LIMITS[tier].researchPerDay;
  const now = new Date();
  const nowMs = now.getTime();

  const currentResetAt = (user as { researchCountResetAt?: string }).researchCountResetAt;
  const resetMs = currentResetAt ? Date.parse(currentResetAt) : NaN;

  // Determine effective starting count + reset boundary
  let startCount = (user as { researchCountDay?: number }).researchCountDay ?? 0;
  let resetAt = currentResetAt ?? nextUtcMidnight(now);
  if (!Number.isFinite(resetMs) || nowMs >= resetMs) {
    // Reset window has elapsed (or never set) — start fresh
    startCount = 0;
    resetAt = nextUtcMidnight(now);
  }

  const proposed = startCount + count;
  if (proposed > limit) {
    return { ok: false, used: startCount, limit, resetAt };
  }

  await updateItem(userPK(user.id), userSK(), {
    researchCountDay: proposed,
    researchCountResetAt: resetAt,
    updatedAt: now.toISOString(),
  });

  return { ok: true, nextUsed: proposed, resetAt };
}

/**
 * The single entrypoint handlers should call before kicking off any research.
 * Reads the current User row, runs all checks, and (on success) increments
 * the rate-limit counter atomically.
 */
export async function enforceResearchEligibility(input: {
  user: User & Record<string, unknown>;
  competitors: Array<{ name: string; url: string }>;
}): Promise<EligibilityResult> {
  // 1. Account-status check
  const status: AccountStatus = (input.user.status as AccountStatus | undefined) ?? 'active';
  if (status === 'restricted') {
    return {
      allowed: false,
      code: 'ACCOUNT_RESTRICTED',
      reason: 'Your account is currently restricted. Please contact support.',
    };
  }
  if (status === 'pending-deletion') {
    return {
      allowed: false,
      code: 'ACCOUNT_PENDING_DELETION',
      reason: 'Your account is pending deletion and cannot start new research.',
    };
  }

  // 1b. Monthly cost cap. Reads the denormalized monthToDateCostUsd cache that
  // the nightly aggregator writes; up to 24h stale at worst, which is fine in
  // combination with the synchronous researchPerDay rate-limit below.
  // The override `monthlyTokenBudget` (per-user) trumps the tier-level cap.
  const tier: PlanTier = input.user.plan ?? 'scout';
  const tierCostCap = PLAN_LIMITS[tier].monthlyCostCap;
  const userOverride = (input.user as { monthlyTokenBudget?: number }).monthlyTokenBudget;
  const effectiveCap =
    typeof userOverride === 'number' && userOverride > 0 ? userOverride : tierCostCap;
  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const cachedMonth = (input.user as { monthToDateCostMonth?: string }).monthToDateCostMonth;
  const cachedCost = (input.user as { monthToDateCostUsd?: number }).monthToDateCostUsd ?? 0;
  // Only enforce when the cached month matches today; on month rollover we
  // treat the stale cache as zero (the nightly aggregator will refresh it).
  const monthToDate = cachedMonth === currentMonth ? cachedCost : 0;
  if (monthToDate >= effectiveCap) {
    logger.info('research_eligibility_denied', {
      userId: input.user.id,
      reason: 'cost-cap',
      monthToDate,
      cap: effectiveCap,
      month: currentMonth,
    });
    return {
      allowed: false,
      code: 'COST_CAP_EXCEEDED',
      reason: `You've reached your monthly research budget ($${monthToDate.toFixed(2)} of $${effectiveCap.toFixed(2)}). The cap resets at the start of next month, or upgrade your plan to increase it.`,
      costCapInfo: {
        monthToDateCostUsd: monthToDate,
        capUsd: effectiveCap,
        month: currentMonth,
      },
    };
  }

  // 2. Sanctions / personal-name denylist (sync, deterministic)
  for (const c of input.competitors) {
    const sanctionsResult = checkSanctions(c);
    if (sanctionsResult.isBlocked) {
      logger.info('research_eligibility_denied', {
        userId: input.user.id,
        reason: sanctionsResult.category,
        competitorName: c.name,
      });
      return {
        allowed: false,
        code: sanctionsResult.category === 'sanctioned-domain' ? 'SANCTIONED_TARGET' : 'PERSONAL_NAME_PATTERN',
        reason: sanctionsResult.reason,
      };
    }
  }

  // 3. Rate limit (counts each competitor against the daily quota)
  const rateLimit = await incrementRateLimit(input.user, input.competitors.length);
  if (!rateLimit.ok) {
    logger.info('research_eligibility_denied', {
      userId: input.user.id,
      reason: 'rate-limit',
      used: rateLimit.used,
      limit: rateLimit.limit,
      requestedCount: input.competitors.length,
    });
    return {
      allowed: false,
      code: 'RATE_LIMIT_EXCEEDED',
      reason: `You've reached your daily research limit (${rateLimit.used}/${rateLimit.limit}). Quota resets at ${rateLimit.resetAt}.`,
      rateLimitInfo: {
        used: rateLimit.used,
        limit: rateLimit.limit,
        resetAt: rateLimit.resetAt,
      },
    };
  }

  // 4. Haiku classifier — runs in parallel for multiple competitors
  const classifications = await Promise.all(
    input.competitors.map((c) =>
      classifyResearchTarget({ name: c.name, url: c.url, userId: input.user.id })
    )
  );

  for (let i = 0; i < classifications.length; i++) {
    const result = classifications[i];
    if (!result.isBusiness) {
      logger.info('research_eligibility_denied', {
        userId: input.user.id,
        reason: result.rejectionCategory ?? 'classifier-rejected',
        competitorName: input.competitors[i].name,
      });
      const codeMap: Record<string, IneligibilityCode> = {
        'individual-person': 'INDIVIDUAL_PERSON_TARGET',
        'non-commercial': 'NON_COMMERCIAL_TARGET',
        'protected-group-target': 'PROTECTED_GROUP_TARGET',
        'unable-to-determine': 'CLASSIFIER_UNAVAILABLE',
      };
      return {
        allowed: false,
        code: codeMap[result.rejectionCategory ?? 'unable-to-determine'] ?? 'CLASSIFIER_UNAVAILABLE',
        reason: result.reason,
      };
    }
  }

  return { allowed: true };
}
