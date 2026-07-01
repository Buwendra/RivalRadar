import { describe, expect, it } from 'vitest';
import { computeMomentum, buildChangesByDay } from './competitor-metrics';

/** Build a {date,count} series from a flat array of daily counts. */
function series(counts: number[]): Array<{ date: string; count: number }> {
  return counts.map((count, i) => ({ date: `d-${i}`, count }));
}

/**
 * Build a 30-day series with `priorTotal` changes spread over the first 23 days
 * and `last7Total` over the final 7 — so `current7d === last7Total` and the
 * smoothed prior baseline derives from `priorTotal`.
 */
function build(priorTotal: number, last7Total: number): Array<{ date: string; count: number }> {
  const arr = new Array(30).fill(0);
  for (let k = 0; k < priorTotal; k++) arr[k % 23] += 1;
  for (let k = 0; k < last7Total; k++) arr[23 + (k % 7)] += 1;
  return series(arr);
}

describe('computeMomentum', () => {
  it('returns insufficient-data with fewer than 14 days of history', () => {
    const { momentum } = computeMomentum({ changesByDay: series(new Array(10).fill(1)) });
    expect(momentum).toBe('insufficient-data');
  });

  it('returns insufficient-data when total changes in the window are below 3', () => {
    const arr = new Array(30).fill(0);
    arr[0] = 1;
    arr[29] = 1; // total 2
    const { momentum } = computeMomentum({ changesByDay: series(arr) });
    expect(momentum).toBe('insufficient-data');
  });

  it('classifies a clear uptick as rising', () => {
    expect(computeMomentum({ changesByDay: build(6, 10) }).momentum).toBe('rising');
  });

  it('classifies steady activity as stable', () => {
    expect(computeMomentum({ changesByDay: build(12, 4) }).momentum).toBe('stable');
  });

  it('classifies a moderate drop as slowing', () => {
    expect(computeMomentum({ changesByDay: build(14, 2) }).momentum).toBe('slowing');
  });

  it('classifies a collapse to zero as declining', () => {
    expect(computeMomentum({ changesByDay: build(21, 0) }).momentum).toBe('declining');
  });

  it('does not explode the percentage on tiny prior baselines', () => {
    // 1 prior change, 3 this week — naive 7d-vs-7d would read +∞/+999%.
    const { momentum, momentumChangePercent } = computeMomentum({ changesByDay: build(1, 3) });
    expect(momentum).toBe('rising');
    expect(momentumChangePercent).toBeLessThan(200);
    expect(momentumChangePercent).not.toBe(999);
  });

  it('handles a fresh burst from zero prior activity without a sentinel value', () => {
    const { momentum, momentumChangePercent } = computeMomentum({ changesByDay: build(0, 5) });
    expect(momentum).toBe('rising');
    expect(Number.isFinite(momentumChangePercent)).toBe(true);
    expect(momentumChangePercent).toBeLessThan(999);
  });
});

describe('buildChangesByDay', () => {
  it('buckets ISO timestamps into a 30-day series, newest last', () => {
    const now = new Date('2026-01-30T12:00:00Z');
    const buckets = buildChangesByDay(
      ['2026-01-30T01:00:00Z', '2026-01-30T05:00:00Z', '2026-01-29T10:00:00Z'],
      now
    );
    expect(buckets).toHaveLength(30);
    expect(buckets[29].count).toBe(2); // today
    expect(buckets[28].count).toBe(1); // yesterday
    expect(buckets[0].count).toBe(0); // 29 days ago
  });

  it('ignores timestamps outside the 30-day window and unparseable input', () => {
    const now = new Date('2026-01-30T12:00:00Z');
    const buckets = buildChangesByDay(['2025-01-01T00:00:00Z', 'not-a-date'], now);
    expect(buckets.reduce((n, b) => n + b.count, 0)).toBe(0);
  });
});
