import { describe, expect, it } from 'vitest';
import { computeShareOfVoice } from './share-of-voice';

const entities = [
  { id: 'self-1', name: 'Acme', isSelf: true },
  { id: 'comp-1', name: 'Globex', isSelf: false },
  { id: 'comp-2', name: 'Initech', isSelf: false },
];

describe('computeShareOfVoice', () => {
  it('returns empty overall + zeroed per-category when no changes', () => {
    const result = computeShareOfVoice({
      entities,
      changes: [],
      windowDays: 30,
    });
    expect(result.totalChanges).toBe(0);
    expect(result.overall).toHaveLength(3);
    expect(result.overall.every((r) => r.count === 0 && r.percent === 0)).toBe(true);
    expect(result.byCategory.news).toHaveLength(3);
    expect(result.byCategory.news.every((r) => r.count === 0)).toBe(true);
  });

  it('aggregates counts per-category and overall', () => {
    const result = computeShareOfVoice({
      entities,
      changes: [
        { competitorId: 'self-1', sourceCategory: 'news', detectedAt: '2026-05-10' },
        { competitorId: 'self-1', sourceCategory: 'product', detectedAt: '2026-05-11' },
        { competitorId: 'comp-1', sourceCategory: 'news', detectedAt: '2026-05-12' },
        { competitorId: 'comp-1', sourceCategory: 'news', detectedAt: '2026-05-13' },
        { competitorId: 'comp-1', sourceCategory: 'news', detectedAt: '2026-05-14' },
        { competitorId: 'comp-2', sourceCategory: 'funding', detectedAt: '2026-05-15' },
      ],
      windowDays: 30,
    });
    expect(result.totalChanges).toBe(6);

    // News: comp-1 has 3, self-1 has 1, comp-2 has 0
    const news = result.byCategory.news;
    expect(news[0]).toMatchObject({ name: 'Globex', count: 3, percent: 75 });
    expect(news[1]).toMatchObject({ name: 'Acme', count: 1, percent: 25 });
    expect(news[2]).toMatchObject({ name: 'Initech', count: 0, percent: 0 });

    // Funding: only comp-2 has 1
    const funding = result.byCategory.funding;
    expect(funding[0]).toMatchObject({ name: 'Initech', count: 1, percent: 100 });
  });

  it('preserves the isSelf flag and never floats self-row artificially', () => {
    const result = computeShareOfVoice({
      entities,
      changes: [
        { competitorId: 'comp-1', sourceCategory: 'news', detectedAt: '2026-05-12' },
        { competitorId: 'comp-1', sourceCategory: 'news', detectedAt: '2026-05-13' },
      ],
      windowDays: 7,
    });
    const news = result.byCategory.news;
    // comp-1 leads despite self ranking below — that's the truthful order.
    expect(news[0]).toMatchObject({ name: 'Globex', count: 2, isSelf: false });
    const selfRow = news.find((r) => r.name === 'Acme');
    expect(selfRow?.isSelf).toBe(true);
  });

  it('drops changes whose competitorId no longer resolves', () => {
    const result = computeShareOfVoice({
      entities,
      changes: [
        { competitorId: 'self-1', sourceCategory: 'news', detectedAt: '2026-05-10' },
        { competitorId: 'deleted-x', sourceCategory: 'news', detectedAt: '2026-05-11' },
      ],
      windowDays: 30,
    });
    expect(result.totalChanges).toBe(1);
  });

  it('returns the requested window with computed start/end', () => {
    const now = new Date('2026-05-20T00:00:00Z');
    const result = computeShareOfVoice({
      entities,
      changes: [],
      windowDays: 7,
      now,
    });
    expect(result.window.days).toBe(7);
    expect(result.window.end).toBe(now.toISOString());
    expect(new Date(result.window.start).getTime()).toBe(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    );
  });
});
