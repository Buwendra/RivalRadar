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
import { atomicAdd, conditionalUpdate } from '../db/queries';
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
 * Race-free daily rate-limit increment (misuse-defense throttle).
 *
 * The old read-modify-write let N parallel requests all observe count =
 * limit-1 and all pass — an attacker got ~N free research runs per burst.
 * Now a two-phase conditional write:
 *   1. Same window: ADD `count` while `researchCountResetAt` matches AND the
 *      counter has headroom.
 *   2. Window rolled (or never set): atomically RESET to `count` guarded by
 *      "stored resetAt is missing or in the past", so two racers can't both
 *      reset-and-claim.
 * Any conditional failure that isn't explained by a rollover means the
 * limit is genuinely hit.
 */
async function incrementRateLimit(
  user: User & Record<string, unknown>,
  count: number
): Promise<{ ok: true; nextUsed: number; resetAt: string } | { ok: false; used: number; limit: number; resetAt: string }> {
  const tier: PlanTier = user.plan ?? 'scout';
  const limit = PLAN_LIMITS[tier].researchPerDay;
  const now = new Date();
  const nowIso = now.toISOString();
  const freshResetAt = nextUtcMidnight(now);

  if (count > limit) {
    return { ok: false, used: 0, limit, resetAt: freshResetAt };
  }

  const currentResetAt = (user as { researchCountResetAt?: string }).researchCountResetAt;

  // Phase 1 — increment within the currently-stored window.
  if (currentResetAt && Date.parse(currentResetAt) > now.getTime()) {
    const added = await conditionalUpdate({
      pk: userPK(user.id),
      sk: userSK(),
      update: 'ADD #c :count SET #u = :now',
      condition: '#r = :resetAt AND (attribute_not_exists(#c) OR #c <= :headroom)',
      names: { '#c': 'researchCountDay', '#r': 'researchCountResetAt', '#u': 'updatedAt' },
      values: {
        ':count': count,
        ':resetAt': currentResetAt,
        ':headroom': limit - count,
        ':now': nowIso,
      },
    });
    if (added) {
      const startCount = (user as { researchCountDay?: number }).researchCountDay ?? 0;
      return { ok: true, nextUsed: startCount + count, resetAt: currentResetAt };
    }
    // Condition failed with a live window → over the limit (or the row's
    // window moved under us, which also means another request just reset it
    // and this one should re-observe as denied — safe direction).
    const used = (user as { researchCountDay?: number }).researchCountDay ?? limit;
    return { ok: false, used, limit, resetAt: currentResetAt };
  }

  // Phase 2 — window elapsed or never set: reset-and-claim atomically.
  const reset = await conditionalUpdate({
    pk: userPK(user.id),
    sk: userSK(),
    update: 'SET #c = :count, #r = :freshReset, #u = :now',
    condition: 'attribute_not_exists(#r) OR #r <= :nowIso',
    names: { '#c': 'researchCountDay', '#r': 'researchCountResetAt', '#u': 'updatedAt' },
    values: {
      ':count': count,
      ':freshReset': freshResetAt,
      ':nowIso': nowIso,
      ':now': nowIso,
    },
  });
  if (reset) {
    return { ok: true, nextUsed: count, resetAt: freshResetAt };
  }
  // A concurrent request won the reset race — treat as denied rather than
  // stacking increments onto a window this invocation never observed.
  return { ok: false, used: limit, limit, resetAt: freshResetAt };
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

  // 1b. Monthly cost cap. Reads the denormalized monthToDateCostUsd cache.
  // Since Issue 7, callAnthropic bumps this cache in real time via atomicAdd
  // after every successful call, with the nightly aggregator as a reconciliation
  // safety net — so enforcement is effectively current, not 24h-stale. Combined
  // with the synchronous researchPerDay rate-limit below this is robust for
  // honest use (a narrow fire-and-forget concurrency window remains; see the
  // cost-cap block in anthropic.ts). The per-user `monthlyTokenBudget` override
  // trumps the tier-level cap.
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
      // The counter was incremented at step 3 but this batch never runs —
      // refund the quota so a legitimate user's typo'd target doesn't burn
      // their day. (Increment-before-classify stays: over-quota users must
      // not get free Haiku calls. Best-effort: a failed refund just means a
      // slightly conservative counter until midnight.)
      await atomicAdd(
        userPK(input.user.id),
        userSK(),
        'researchCountDay',
        -input.competitors.length
      ).catch((err: unknown) => {
        logger.warn('research_eligibility: quota refund failed', {
          userId: input.user.id,
          err: err instanceof Error ? err.message : String(err),
        });
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
