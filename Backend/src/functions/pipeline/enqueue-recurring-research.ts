/**
 * Scheduled Lambda — runs weekly (Sunday 6am UTC) to re-research every active
 * competitor whose tier-default cadence has elapsed since its last research.
 *
 * Without this, the Monday digest pipeline has nothing fresh to summarize after
 * the user's first week (research today only fires on onboarding or manual click).
 *
 * Approach:
 *   1. Query GSI2 (PK=ACTIVE) for all active Competitor records.
 *   2. Load each competitor's parent User record (cached per-user across the run).
 *   3. Filter to competitors whose lastResearchAt + cadenceDays <= now.
 *   4. Group due competitors by userId.
 *   5. For each user batch: run `enforceResearchEligibility` (status / sanctions /
 *      cost cap / rate limit / classifier). On allow → start ResearchPipeline with
 *      the batch. On deny → log and skip.
 *   6. Stamp `lastRecurringResearchAt` on each enqueued competitor for visibility.
 *
 * Idempotency: if this Lambda is invoked twice (EventBridge retry), the cadence
 * skip-check + the rate-limit increment together prevent double work — the
 * second invocation finds nothing due (because momentumAsOf was just bumped by
 * the first run's outcomes, or the rate limit blocks the duplicate batch).
 *
 * Concurrency: ResearchPipeline state machine has `maxConcurrency: 1` on its
 * Map state, so kicking off one execution per user is safe — each execution
 * serializes its own competitor research internally.
 */

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { queryGSI, getItem, updateItem } from '../../shared/db/queries';
import { competitorPK, competitorSK, userPK, userSK } from '../../shared/db/keys';
import { enforceResearchEligibility } from '../../shared/utils/research-eligibility';
import { PLAN_LIMITS } from '../../shared/types';
import type { User } from '../../shared/types/user';
import type { Competitor } from '../../shared/types/competitor';
import { logger } from '../../shared/utils/logger';

const sfn = new SFNClient({});

interface EnqueueResult {
  competitorsScanned: number;
  competitorsDue: number;
  usersConsidered: number;
  executionsStarted: number;
  competitorsEnqueued: number;
  rejectedByEligibility: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolve the timestamp of the most recent research for a competitor.
 * `momentumAsOf` is updated by `deep-research.ts` on every successful
 * enrichment pass, so it tracks "any research run" regardless of trigger.
 * Falls back to `lastRecurringResearchAt`, then `updatedAt`, then 0
 * (treats brand-new competitors with no prior research as immediately due).
 */
function lastResearchedAt(c: Competitor & Record<string, unknown>): number {
  const candidates = [
    c.momentumAsOf,
    (c as { lastRecurringResearchAt?: string }).lastRecurringResearchAt,
    c.updatedAt,
  ];
  let best = 0;
  for (const ts of candidates) {
    if (typeof ts !== 'string') continue;
    const ms = Date.parse(ts);
    if (Number.isFinite(ms) && ms > best) best = ms;
  }
  return best;
}

function isDue(
  c: Competitor & Record<string, unknown>,
  user: User,
  nowMs: number
): boolean {
  const tierDefault = PLAN_LIMITS[user.plan ?? 'scout'].researchCadenceDaysDefault;
  const cadenceDays =
    typeof c.researchCadenceDays === 'number' && c.researchCadenceDays > 0
      ? c.researchCadenceDays
      : tierDefault;
  const last = lastResearchedAt(c);
  if (last === 0) return true; // never researched
  // Minus a half-day to absorb scheduler drift; treat "fresh enough within
  // the last (cadence-0.5) days" as not due. Avoids double-running if the
  // cadence is N days and the scheduler fires almost-but-not-quite N days
  // after the last research.
  return nowMs - last >= (cadenceDays - 0.5) * MS_PER_DAY;
}

export const handler = async (): Promise<EnqueueResult> => {
  const stateMachineArn = process.env.RESEARCH_PIPELINE_ARN;
  if (!stateMachineArn) {
    throw new Error('RESEARCH_PIPELINE_ARN env var is required');
  }

  const result: EnqueueResult = {
    competitorsScanned: 0,
    competitorsDue: 0,
    usersConsidered: 0,
    executionsStarted: 0,
    competitorsEnqueued: 0,
    rejectedByEligibility: 0,
  };
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // 1. Page through all active competitors via GSI2
  const activeCompetitors: Array<Competitor & Record<string, unknown>> = [];
  let cursor: string | undefined;
  do {
    const page = await queryGSI('GSI2', 'GSI2PK', 'ACTIVE', 'COMP#', { cursor });
    for (const item of page.items) {
      activeCompetitors.push(item as unknown as Competitor & Record<string, unknown>);
    }
    cursor = page.cursor;
  } while (cursor);
  result.competitorsScanned = activeCompetitors.length;

  // 2. Group by userId and resolve user records (cached so we do at most
  //    one read per user even if they have many competitors)
  const userCache = new Map<string, (User & Record<string, unknown>) | null>();
  const dueByUser = new Map<string, Array<Competitor & Record<string, unknown>>>();

  for (const comp of activeCompetitors) {
    let user = userCache.get(comp.userId);
    if (user === undefined) {
      user =
        (await getItem<User & Record<string, unknown>>(userPK(comp.userId), userSK())) ?? null;
      userCache.set(comp.userId, user);
    }
    if (!user) continue;
    if (!isDue(comp, user, nowMs)) continue;
    const list = dueByUser.get(comp.userId) ?? [];
    list.push(comp);
    dueByUser.set(comp.userId, list);
  }
  result.competitorsDue = Array.from(dueByUser.values()).reduce((n, arr) => n + arr.length, 0);
  result.usersConsidered = dueByUser.size;

  // 3. Per-user: eligibility gate then SFN start
  for (const [userId, dueComps] of dueByUser) {
    const user = userCache.get(userId);
    if (!user) continue; // defensive; shouldn't happen given the build above

    let eligibility;
    try {
      eligibility = await enforceResearchEligibility({
        user,
        competitors: dueComps.map((c) => ({ name: c.name, url: c.url })),
      });
    } catch (err) {
      logger.warn('enqueue-recurring-research: eligibility check threw — skipping user', {
        userId,
        error: String(err),
      });
      result.rejectedByEligibility += dueComps.length;
      continue;
    }
    if (!eligibility.allowed) {
      logger.info('enqueue-recurring-research: skipped user — eligibility denied', {
        userId,
        code: eligibility.code,
        dueCount: dueComps.length,
      });
      result.rejectedByEligibility += dueComps.length;
      continue;
    }

    try {
      await sfn.send(
        new StartExecutionCommand({
          stateMachineArn,
          input: JSON.stringify({
            competitors: dueComps.map((c) => ({
              competitorId: c.id,
              userId: c.userId,
              name: c.name,
              url: c.url,
              industry: (c as { industry?: string }).industry,
            })),
          }),
        })
      );
      result.executionsStarted += 1;
      result.competitorsEnqueued += dueComps.length;

      // 4. Stamp lastRecurringResearchAt on each enqueued competitor
      // (best-effort — failure here doesn't unwind the SFN start).
      await Promise.all(
        dueComps.map((c) =>
          updateItem(competitorPK(c.userId), competitorSK(c.id), {
            lastRecurringResearchAt: nowIso,
            updatedAt: nowIso,
          }).catch((err) =>
            logger.warn('enqueue-recurring-research: failed to stamp lastRecurringResearchAt', {
              competitorId: c.id,
              error: String(err),
            })
          )
        )
      );
    } catch (err) {
      logger.error('enqueue-recurring-research: SFN start failed', {
        userId,
        dueCount: dueComps.length,
        error: String(err),
      });
    }
  }

  logger.info('enqueue-recurring-research completed', result);
  return result;
};
