/**
 * GET /admin/business
 *
 * Phase 8b — owner-only business-health snapshot. Returns aggregated MRR,
 * ARR, MRR-by-tier, churn rate (last 30 days), gross margin (MRR – Anthropic
 * cost), top-cost users, and recent cancellation reasons.
 *
 * Auth model (MVP): authenticated route + an in-handler check that the JWT
 * email is in the comma-separated `ADMIN_EMAILS` env var. A real role system
 * arrives with Phase 4 (workspaces) — until then, this minimal allowlist is
 * fine for a single-owner business. The Lambda's IAM grant already covers
 * the table-wide reads it needs.
 *
 * Performance: one Scan + a few queries. At MVP scale (<200 users) this
 * completes in well under a second. If the user table grows past ~5k rows,
 * factor the Scan into a daily aggregator + cached row.
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { ddb, TABLE_NAME } from '../../../shared/db/client';
import { logger } from '../../../shared/utils/logger';
import type { PlanTier, Subscription, CostDay, User, CancellationFeedback } from '../../../shared/types';

// MVP pricing — sourced from the Frontend constants but inlined here so the
// admin endpoint doesn't need to reach across the build boundary. Update
// alongside Frontend/src/lib/utils/constants.ts if prices change.
const PLAN_PRICES: Record<PlanTier, number> = {
  scout: 49,
  strategist: 99,
  command: 199,
};

interface AdminBusinessResponse {
  asOf: string;
  /** Monthly recurring revenue in USD, summed across all active subscriptions. */
  mrrUsd: number;
  /** Annualized recurring revenue (mrr * 12). */
  arrUsd: number;
  mrrByTier: Record<PlanTier, { count: number; mrrUsd: number }>;
  /** Active vs canceled subscription counts. */
  activeSubscriptions: number;
  /** Subscriptions canceled in last 30 days. */
  canceledLast30Days: number;
  /** % churn — canceledLast30Days / (activeSubscriptions + canceledLast30Days), 0 if no subscriptions. */
  churnRatePercent: number;
  /** Total Anthropic spend last 30 days, summed across all CostDay rows. */
  ai30dSpendUsd: number;
  /** Gross margin estimate: MRR - (ai30dSpendUsd / 30 * 30). For MVP, just MRR-AI cost. */
  grossMarginUsd: number;
  /** Top 10 highest-cost users in the last 30 days. */
  topCostUsers: Array<{ userId: string; email?: string; costUsd: number }>;
  /** Most recent cancellation feedback (last 10 submitted). */
  recentCancellations: Array<{
    plan: string;
    reason: string;
    freeText?: string;
    submittedAt: string;
  }>;
}

function isAdminEmail(email: string): boolean {
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  if (!isAdminEmail(email)) {
    throw new HttpError(403, 'FORBIDDEN', 'Admin access required.');
  }

  const now = new Date();
  const cutoffMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);

  // Scan strategy: single scan, then partition rows by SK prefix in-memory.
  // At MVP scale (<5k rows) this is much cheaper than 4 separate scans with
  // FilterExpression. The result has SUB rows, USER PROFILE rows, COST rows,
  // CANCEL_FEEDBACK rows mixed together — partition by attribute shape.
  const subscriptions: Subscription[] = [];
  const usersById: Record<string, User> = {};
  const costDays: CostDay[] = [];
  const cancellations: CancellationFeedback[] = [];

  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ExclusiveStartKey: lastKey,
      })
    );
    for (const raw of (result.Items ?? []) as Record<string, unknown>[]) {
      const sk = raw.SK as string | undefined;
      if (sk === 'SUB') {
        subscriptions.push(raw as unknown as Subscription);
      } else if (sk === 'PROFILE' && raw.id) {
        usersById[raw.id as string] = raw as unknown as User;
      } else if (typeof sk === 'string' && sk.startsWith('COST#')) {
        // Only count days within the 30-day window
        if ((raw.date as string) >= cutoffDate) {
          costDays.push(raw as unknown as CostDay);
        }
      } else if (sk === 'META' && (raw.PK as string)?.startsWith('CANCEL_FEEDBACK#')) {
        if (raw.submittedAt) cancellations.push(raw as unknown as CancellationFeedback);
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  // ─── MRR aggregation ───
  const mrrByTier: AdminBusinessResponse['mrrByTier'] = {
    scout: { count: 0, mrrUsd: 0 },
    strategist: { count: 0, mrrUsd: 0 },
    command: { count: 0, mrrUsd: 0 },
  };
  let activeSubscriptions = 0;
  let canceledLast30Days = 0;

  for (const sub of subscriptions) {
    const tier = sub.plan as PlanTier | undefined;
    const status = sub.status as string | undefined;
    if (status === 'active' && tier && tier in mrrByTier) {
      activeSubscriptions += 1;
      const price = PLAN_PRICES[tier];
      mrrByTier[tier].count += 1;
      mrrByTier[tier].mrrUsd += price;
    } else if (status === 'canceled' && sub.updatedAt) {
      const ts = Date.parse(sub.updatedAt);
      if (Number.isFinite(ts) && ts >= cutoffMs) canceledLast30Days += 1;
    }
  }

  const mrrUsd = Object.values(mrrByTier).reduce((acc, b) => acc + b.mrrUsd, 0);
  const arrUsd = mrrUsd * 12;
  const totalSubs = activeSubscriptions + canceledLast30Days;
  const churnRatePercent =
    totalSubs > 0 ? Number(((canceledLast30Days / totalSubs) * 100).toFixed(2)) : 0;

  // ─── Cost aggregation ───
  const costByUser = new Map<string, number>();
  let ai30dSpendUsd = 0;
  for (const cd of costDays) {
    const cost = (cd.totalCostUsd as number | undefined) ?? 0;
    ai30dSpendUsd += cost;
    costByUser.set((cd.userId as string), (costByUser.get(cd.userId) ?? 0) + cost);
  }

  const topCostUsers = Array.from(costByUser.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, costUsd]) => ({
      userId,
      email: usersById[userId]?.email,
      costUsd: Number(costUsd.toFixed(4)),
    }));

  const grossMarginUsd = Number((mrrUsd - ai30dSpendUsd).toFixed(2));

  // ─── Cancellation feedback ───
  const recentCancellations = cancellations
    .filter((c) => !!c.submittedAt)
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
    .slice(0, 10)
    .map((c) => ({
      plan: c.plan,
      reason: (c.reason as string) ?? 'unknown',
      freeText: c.freeText,
      submittedAt: c.submittedAt!,
    }));

  const response: AdminBusinessResponse = {
    asOf: now.toISOString(),
    mrrUsd: Number(mrrUsd.toFixed(2)),
    arrUsd: Number(arrUsd.toFixed(2)),
    mrrByTier,
    activeSubscriptions,
    canceledLast30Days,
    churnRatePercent,
    ai30dSpendUsd: Number(ai30dSpendUsd.toFixed(2)),
    grossMarginUsd,
    topCostUsers,
    recentCancellations,
  };

  logger.info('admin_business_snapshot', {
    requestedBy: email,
    mrrUsd: response.mrrUsd,
    activeSubscriptions: response.activeSubscriptions,
    churnRatePercent: response.churnRatePercent,
  });

  return {
    statusCode: 200,
    body: { data: response },
  };
});
