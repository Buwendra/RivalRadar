import type { Momentum } from '../types';

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
