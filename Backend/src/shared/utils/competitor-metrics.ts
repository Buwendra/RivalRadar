import type { Momentum, ThreatLevel, DerivedState } from '../types';

/**
 * Rule-based momentum classifier for a competitor.
 *
 * Input is a 30-day series of change counts (as produced by `computeStats`
 * in `functions/api/competitors/get.ts`), oldest first and newest last.
 *
 * Buckets:
 *   pct >= +25%   → rising
 *   pct in [-15, +25) → stable
 *   pct in [-40, -15)  → slowing
 *   pct < -40%    → declining
 *
 * Guardrails:
 *   - Fewer than 14 days of input → insufficient-data.
 *   - Total changes across the 14-day window < 3 → insufficient-data.
 *   - Prior window zero but current positive → rising (capped at +999%).
 *   - Current zero but prior positive → declining (-100%).
 */
export function computeMomentum(input: {
  changesByDay: Array<{ date: string; count: number }>;
}): { momentum: Momentum; momentumChangePercent: number } {
  const series = input.changesByDay;
  if (!Array.isArray(series) || series.length < 14) {
    return { momentum: 'insufficient-data', momentumChangePercent: 0 };
  }

  const n = series.length;
  const sum = (start: number, end: number) =>
    series.slice(start, end).reduce((acc, d) => acc + (d.count ?? 0), 0);

  const current7d = sum(n - 7, n);
  const prior7d = sum(n - 14, n - 7);
  const total = current7d + prior7d;

  if (total < 3) {
    return { momentum: 'insufficient-data', momentumChangePercent: 0 };
  }

  if (prior7d === 0) {
    return { momentum: 'rising', momentumChangePercent: 999 };
  }
  if (current7d === 0) {
    return { momentum: 'declining', momentumChangePercent: -100 };
  }

  const pct = Math.round(((current7d - prior7d) / prior7d) * 100);

  if (pct >= 25) return { momentum: 'rising', momentumChangePercent: pct };
  if (pct >= -15) return { momentum: 'stable', momentumChangePercent: pct };
  if (pct >= -40) return { momentum: 'slowing', momentumChangePercent: pct };
  return { momentum: 'declining', momentumChangePercent: pct };
}

/**
 * Derive 5-6 user-readable competitor tag chips from the structured signal we
 * already collect (DerivedState from research + Change history + momentum +
 * threat). Pure rules — no AI cost. Priority-ordered so the most actionable
 * concerns surface first when capping at 6.
 *
 * Returns slug-style tags (e.g. 'just-raised', 'going-upmarket'). The frontend
 * maps these to display labels and styling tones.
 */
export function deriveTagsFromState(input: {
  derivedState?: DerivedState;
  recentChanges: Array<{ sourceCategory?: string; detectedAt: string }>;
  momentum: Momentum;
  threatLevel?: ThreatLevel;
}): string[] {
  const tagged: Array<{ tag: string; priority: number }> = [];
  const ds = input.derivedState;
  const dayMs = 24 * 60 * 60 * 1000;
  const cutoff30 = Date.now() - 30 * dayMs;

  // Priority 0 — Concerns. Surface red flags first.
  if (ds?.fundingState === 'runway-concerns') {
    tagged.push({ tag: 'runway-low', priority: 0 });
  }
  if (ds?.hiringState === 'layoffs') {
    tagged.push({ tag: 'layoffs', priority: 0 });
  }

  // Priority 1 — Recent funding event. Combines DerivedState with a
  // confirming Change record so we don't tag stale "recently raised".
  if (ds?.fundingState === 'recently-raised') {
    const hasFundingChange30d = input.recentChanges.some((c) => {
      if (c.sourceCategory !== 'funding') return false;
      const ts = Date.parse(c.detectedAt);
      return !isNaN(ts) && ts >= cutoff30;
    });
    if (hasFundingChange30d) {
      tagged.push({ tag: 'just-raised', priority: 1 });
    }
  }

  // Priority 2 — Stage. Skip 'unknown'/'public' (public goes to funding bucket below).
  if (ds?.stage && ds.stage !== 'unknown' && ds.stage !== 'public') {
    tagged.push({ tag: `${ds.stage}-stage`, priority: 2 });
  }

  // Priority 3 — Funding state (mutually exclusive with concerns above).
  if (ds?.fundingState === 'public') {
    tagged.push({ tag: 'public-co', priority: 3 });
  } else if (ds?.fundingState === 'bootstrapped') {
    tagged.push({ tag: 'bootstrapped', priority: 3 });
  } else if (ds?.fundingState === 'actively-raising') {
    tagged.push({ tag: 'actively-raising', priority: 3 });
  }

  // Priority 4 — Hiring (only signal-bearing values).
  if (ds?.hiringState === 'aggressive') {
    tagged.push({ tag: 'hiring-aggressively', priority: 4 });
  } else if (ds?.hiringState === 'frozen') {
    tagged.push({ tag: 'hiring-frozen', priority: 4 });
  }

  // Priority 5 — Strategic direction. Skip steady/unknown to avoid noise.
  if (
    ds?.strategicDirection &&
    ds.strategicDirection !== 'steady' &&
    ds.strategicDirection !== 'unknown'
  ) {
    tagged.push({ tag: ds.strategicDirection, priority: 5 });
  }

  // Priority 6 — Tech positioning (only the differentiating values).
  if (ds?.techPositioning === 'ai-native') {
    tagged.push({ tag: 'ai-native', priority: 6 });
  } else if (ds?.techPositioning === 'open-source') {
    tagged.push({ tag: 'open-source', priority: 6 });
  }

  // Priority 7 — Pacing.
  if (ds?.pacing === 'shipping-fast') {
    tagged.push({ tag: 'shipping-fast', priority: 7 });
  } else if (ds?.pacing === 'frozen') {
    tagged.push({ tag: 'shipping-frozen', priority: 7 });
  }

  // Priority 8 — Triage hint. Only when both signals say "low priority".
  if (input.momentum === 'declining' && input.threatLevel === 'monitor') {
    tagged.push({ tag: 'deprioritize', priority: 8 });
  }

  // Sort by priority asc, dedupe, cap at 6
  tagged.sort((a, b) => a.priority - b.priority);
  const seen = new Set<string>();
  const output: string[] = [];
  for (const t of tagged) {
    if (seen.has(t.tag)) continue;
    seen.add(t.tag);
    output.push(t.tag);
    if (output.length >= 6) break;
  }
  return output;
}

/**
 * Build a 30-day `changesByDay` series from a list of ISO timestamps.
 * Useful when the caller has the raw changes but not the pre-bucketed stats
 * (e.g. the deep-research Lambda when persisting momentum to the Competitor record).
 * Oldest first (index 0 = 29 days ago), newest last (index 29 = today).
 */
export function buildChangesByDay(
  timestamps: string[],
  now: Date
): Array<{ date: string; count: number }> {
  const dayMs = 24 * 60 * 60 * 1000;
  const buckets: Array<{ date: string; count: number }> = [];
  const index: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    index[key] = buckets.length;
    buckets.push({ date: key, count: 0 });
  }
  for (const ts of timestamps) {
    const parsed = Date.parse(ts);
    if (isNaN(parsed)) continue;
    const key = new Date(parsed).toISOString().slice(0, 10);
    const idx = index[key];
    if (idx !== undefined) buckets[idx].count++;
  }
  return buckets;
}
