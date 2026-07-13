/**
 * Scheduled Lambda — runs daily (4am UTC) to email retention nudges to
 * users who haven't logged in for 7+ days.
 *
 * Eligibility:
 *   - onboardingComplete = true
 *   - status NOT IN ('restricted', 'pending-deletion')
 *   - lastLoginAt < now - 7 days (or absent — 7d-since-onboarding works too)
 *   - lastRetentionNudgeAt absent OR < now - 90 days (quarterly cap)
 *
 * Each eligible user gets a small "what you've missed" email with their
 * change-count over the inactive period. `lastRetentionNudgeAt` is stamped
 * after a successful send so we don't double-fire on cron retry.
 *
 * Best-effort per user — one failure does not block the others. At MVP
 * scale (<200 users) the linear scan + per-user query is well within the
 * 5-minute Lambda budget.
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../../shared/db/client';
import { queryGSI, skPrefixRange, updateItem } from '../../shared/db/queries';
import { userPK, userSK } from '../../shared/db/keys';
import { sendEmail } from '../../shared/services/ses';
import { logger } from '../../shared/utils/logger';
import type { User } from '../../shared/types';

const INACTIVITY_THRESHOLD_DAYS = 7;
const NUDGE_COOLDOWN_DAYS = 90;

interface Result {
  scanned: number;
  eligible: number;
  sent: number;
  failed: number;
}

interface NudgeCandidate {
  userId: string;
  email: string;
  name: string;
  daysSinceLogin: number;
}

function daysAgo(iso: string | undefined, now: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return (now - ms) / (24 * 60 * 60 * 1000);
}

async function findEligibleUsers(now: number): Promise<NudgeCandidate[]> {
  const eligible: NudgeCandidate[] = [];
  let lastKey: Record<string, unknown> | undefined;
  let scanned = 0;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'SK = :sk AND onboardingComplete = :oc',
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
          ':oc': true,
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of (result.Items ?? []) as Array<User & Record<string, unknown>>) {
      scanned += 1;
      // Skip restricted / pending-deletion users
      if (item.status === 'restricted' || item.status === 'pending-deletion') continue;

      const sinceLogin = daysAgo(item.lastLoginAt, now);
      if (sinceLogin < INACTIVITY_THRESHOLD_DAYS) continue;

      const sinceLastNudge = daysAgo(item.lastRetentionNudgeAt, now);
      if (sinceLastNudge < NUDGE_COOLDOWN_DAYS) continue;

      eligible.push({
        userId: item.id,
        email: item.email,
        name: item.name,
        daysSinceLogin: Number.isFinite(sinceLogin) ? Math.floor(sinceLogin) : -1,
      });
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  logger.info('retention_nudge_scan', { scanned, eligible: eligible.length });
  return eligible;
}

async function buildAndSendNudge(
  candidate: NudgeCandidate,
  now: Date
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Personalize: count changes detected since their last login, CAPPED at the
  // last 14 days (a 60-day-inactive user gets a 14-day count, not their whole
  // absence — keeps the query cheap and the copy honest: "in the last two
  // weeks"). Cheap GSI1 query bounded at 50 items.
  const lookbackStart = new Date(
    Math.max(
      now.getTime() - 14 * 24 * 60 * 60 * 1000,
      candidate.daysSinceLogin > 0
        ? now.getTime() - candidate.daysSinceLogin * 24 * 60 * 60 * 1000
        : 0
    )
  ).toISOString();

  let changeCount = 0;
  try {
    const { items } = await queryGSI('GSI1', 'GSI1PK', candidate.userId, undefined, {
      skName: 'GSI1SK',
      skBetween: skPrefixRange('CHANGE#', lookbackStart),
      limit: 50,
      scanForward: false,
    });
    changeCount = items.length;
  } catch (err) {
    logger.warn('retention_nudge: change-count query failed — sending generic copy', {
      userId: candidate.userId,
      error: String(err),
    });
  }

  const dashboardUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboard`;
  const dayLabel =
    candidate.daysSinceLogin >= 0
      ? `${candidate.daysSinceLogin} day${candidate.daysSinceLogin === 1 ? '' : 's'}`
      : 'a while';
  const headlineCount = changeCount > 0
    ? `${changeCount} new change${changeCount === 1 ? '' : 's'}`
    : 'fresh competitive intelligence';

  const subject = `${headlineCount} you haven't seen yet`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #1e3a5f; padding: 20px 28px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 18px;">Kironyx</h1>
      </div>
      <div style="padding: 24px 28px;">
        <p>Hi ${candidate.name},</p>
        <p>It's been ${dayLabel} since you checked in. Your market hasn't stood still${changeCount > 0 ? ` — we've detected <strong>${changeCount} change${changeCount === 1 ? '' : 's'}</strong> across the companies you track` : ''}. See what moved, and where you now stand.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${dashboardUrl}" style="background: #2563eb; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            See what's new
          </a>
        </div>
        <p style="color: #6b7280; font-size: 12px;">
          You're getting this because you haven't logged into Kironyx in over a week. We'll only nudge you again at most once per quarter.
        </p>
      </div>
      <div style="background: #f9fafb; padding: 14px 28px; border-radius: 0 0 8px 8px; text-align: center;">
        <p style="color: #9ca3af; font-size: 11px; margin: 0;">
          AI-generated competitive intelligence. Manage email preferences in your dashboard.
        </p>
      </div>
    </div>
  `;

  // Stamp BEFORE sending: for a marketing nudge, a missed email (send fails
  // after a successful stamp — retried next quarter) is far better than the
  // old order's failure mode, where a failed stamp after a successful send
  // re-mailed the same user every day until the write landed.
  try {
    await updateItem(userPK(candidate.userId), userSK(), {
      lastRetentionNudgeAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('retention_nudge_stamp_failed — skipping send', {
      userId: candidate.userId,
      error,
    });
    return { ok: false, error };
  }

  try {
    await sendEmail(candidate.email, subject, html);
    logger.info('retention_nudge_sent', {
      userId: candidate.userId,
      daysSinceLogin: candidate.daysSinceLogin,
      changeCount,
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('retention_nudge_failed', {
      userId: candidate.userId,
      error,
    });
    return { ok: false, error };
  }
}

export const handler = async (): Promise<Result> => {
  const now = new Date();
  const result: Result = { scanned: -1, eligible: 0, sent: 0, failed: 0 };

  const eligible = await findEligibleUsers(now.getTime());
  result.eligible = eligible.length;

  for (const candidate of eligible) {
    const r = await buildAndSendNudge(candidate, now);
    if (r.ok) result.sent += 1;
    else result.failed += 1;
  }

  logger.info('send-retention-nudges completed', { ...result });
  return result;
};
