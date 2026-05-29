/**
 * Phase 24 — Share of Voice. Pure aggregation over Change records.
 *
 * For each research category (news / product / funding / hiring / social),
 * computes how much "voice" each tracked entity owns in the window — where
 * voice = count of Change records whose `sourceCategory` matches the category
 * and whose `competitorId` matches the entity. The workspace's self-brand row
 * is tagged with `isSelf: true` so the UI can render it differently from
 * competitor entries.
 *
 * Returns both an `overall` ranking (sum across categories) and a per-category
 * breakdown so the SoV page can show one "you vs them" bar at the top and
 * five per-category bars below it.
 */

import type { ResearchCategory } from '../types';

const CATEGORIES: ResearchCategory[] = ['news', 'product', 'funding', 'hiring', 'social', 'industryContext'];

export interface SoVEntity {
  /** Competitor row id (the `id` field on the Competitor row, NOT the PK). */
  id: string;
  /** Display name from the Competitor row. */
  name: string;
  /** `true` for the workspace's self-brand row (`targetKind === 'self'`). */
  isSelf: boolean;
}

export interface ChangeForSov {
  competitorId: string;
  sourceCategory?: string;
  detectedAt: string;
}

export interface SoVRow {
  competitorId: string;
  name: string;
  isSelf: boolean;
  count: number;
  /** Percent of the total within the bucket, rounded to 1 decimal. */
  percent: number;
}

export interface ShareOfVoiceResult {
  /**
   * Window the aggregation covered. ISO timestamps; `windowDays` is the
   * caller-supplied window size (7 / 30 / 90).
   */
  window: { start: string; end: string; days: number };
  /** Total Change records that fell inside the window (across all entities). */
  totalChanges: number;
  /** Ranking across ALL categories combined, descending by count. */
  overall: SoVRow[];
  /** Per-category ranking. Categories with zero data still appear (empty array). */
  byCategory: Record<ResearchCategory, SoVRow[]>;
}

/**
 * Compute SoV given the workspace's competitor rows + a flat list of recent
 * Change records. Caller is responsible for time-bounding the changes input;
 * this function trusts what it's given.
 *
 * Sort order within each category: descending by count, ties broken by name.
 * `isSelf: true` row is NOT artificially floated — it ranks honestly.
 */
export function computeShareOfVoice(input: {
  entities: SoVEntity[];
  changes: ChangeForSov[];
  windowDays: number;
  /** Optional override for the window end; defaults to "now". */
  now?: Date;
}): ShareOfVoiceResult {
  const now = input.now ?? new Date();
  const end = now.toISOString();
  const start = new Date(now.getTime() - input.windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Index entities by id for O(1) lookup, dropping changes whose competitorId
  // doesn't resolve to a known row (stale data from deleted competitors).
  const byId = new Map<string, SoVEntity>();
  for (const e of input.entities) byId.set(e.id, e);

  // Build per-category count maps.
  const totalsByCategory: Record<ResearchCategory, Map<string, number>> = {
    news: new Map(),
    product: new Map(),
    funding: new Map(),
    hiring: new Map(),
    social: new Map(),
    industryContext: new Map(),
  };
  const overallCounts = new Map<string, number>();
  let totalChanges = 0;

  for (const c of input.changes) {
    if (!c.competitorId || !byId.has(c.competitorId)) continue;
    const cat = c.sourceCategory as ResearchCategory | undefined;
    overallCounts.set(c.competitorId, (overallCounts.get(c.competitorId) ?? 0) + 1);
    totalChanges++;
    if (cat && CATEGORIES.includes(cat)) {
      const m = totalsByCategory[cat];
      m.set(c.competitorId, (m.get(c.competitorId) ?? 0) + 1);
    }
  }

  return {
    window: { start, end, days: input.windowDays },
    totalChanges,
    overall: buildRows(input.entities, overallCounts),
    byCategory: {
      news: buildRows(input.entities, totalsByCategory.news),
      product: buildRows(input.entities, totalsByCategory.product),
      funding: buildRows(input.entities, totalsByCategory.funding),
      hiring: buildRows(input.entities, totalsByCategory.hiring),
      social: buildRows(input.entities, totalsByCategory.social),
      industryContext: buildRows(input.entities, totalsByCategory.industryContext),
    },
  };
}

function buildRows(entities: SoVEntity[], counts: Map<string, number>): SoVRow[] {
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  // Include every entity (even zero-count) so the UI can render a stable axis
  // and show "you got 0% this week" rather than hiding the bar entirely.
  const rows: SoVRow[] = entities.map((e) => {
    const count = counts.get(e.id) ?? 0;
    const percent = total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
    return { competitorId: e.id, name: e.name, isSelf: e.isSelf, count, percent };
  });
  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });
  return rows;
}
