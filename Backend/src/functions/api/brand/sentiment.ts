/**
 * GET /brand/sentiment
 *
 * Phase 23 — Brand Pulse. Aggregates per-finding sentiment (positive / neutral
 * / negative) across the workspace's self-brand ResearchFinding history into
 * a weekly time-series. The frontend renders this as a stacked area chart
 * on the "Your Brand" page.
 *
 * Returns the last ~12 weeks by default. Findings with no sentiment label
 * (legacy / failed extraction) are dropped from the count.
 */

import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { loadSelfBrand, loadUserForBrand, assertBrandPulseCapability } from './_shared';
import type { FindingItem, FindingSentiment, ResearchCategory } from '../../../shared/types';

const DEFAULT_WEEKS = 12;

interface WeekBucket {
  weekStart: string; // ISO date (YYYY-MM-DD) for Monday of the week
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

function mondayOf(d: Date): string {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = utc.getUTCDay(); // 0 = Sun, 1 = Mon
  const offset = dow === 0 ? -6 : 1 - dow;
  utc.setUTCDate(utc.getUTCDate() + offset);
  return utc.toISOString().slice(0, 10);
}

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await loadUserForBrand(userId);
  assertBrandPulseCapability(user);

  const self = await loadSelfBrand(userId);
  if (!self) {
    throw new HttpError(404, 'BRAND_NOT_SET_UP', 'Set up your brand profile to see sentiment.');
  }

  // Pull enough findings to cover ~12 weeks of weekly cadence. 20 is a safe
  // upper bound that also includes manual on-demand runs.
  const { items: research } = await queryByPK(`COMP#${self.id}`, 'RESEARCH#', {
    limit: 20,
    scanForward: false,
  });

  // Initialise empty week buckets for the last DEFAULT_WEEKS weeks so the
  // chart axis always renders even when no findings exist.
  const buckets = new Map<string, WeekBucket>();
  const now = new Date();
  for (let i = DEFAULT_WEEKS - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const key = mondayOf(d);
    buckets.set(key, { weekStart: key, positive: 0, neutral: 0, negative: 0, total: 0 });
  }

  for (const finding of research) {
    const generatedAt = finding.generatedAt as string | undefined;
    if (!generatedAt) continue;
    const ts = Date.parse(generatedAt);
    if (isNaN(ts)) continue;
    const weekKey = mondayOf(new Date(ts));
    const bucket = buckets.get(weekKey);
    if (!bucket) continue; // outside window

    const categories =
      (finding.categories as Partial<Record<ResearchCategory, FindingItem[]>> | undefined) ?? {};
    for (const items of Object.values(categories)) {
      for (const item of items ?? []) {
        const s = item.sentiment as FindingSentiment | undefined;
        if (s === 'positive') bucket.positive++;
        else if (s === 'negative') bucket.negative++;
        else if (s === 'neutral') bucket.neutral++;
        if (s) bucket.total++;
      }
    }
  }

  return {
    statusCode: 200,
    body: {
      data: {
        weeks: Array.from(buckets.values()),
      },
    },
  };
});
