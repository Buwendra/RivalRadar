import { describe, expect, it } from 'vitest';
import { computeBrandHealthScore } from './brand-health';
import type { ResearchFinding } from '../types';

const NOW = new Date('2026-05-20T00:00:00Z');

function makeFinding(daysAgo: number, sentiments: Array<'positive' | 'neutral' | 'negative'>): ResearchFinding {
  const generatedAt = new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `f-${daysAgo}`,
    competitorId: 'self-1',
    userId: 'u-1',
    generatedAt,
    summary: 's',
    citations: [],
    searchQueries: [],
    tokensUsed: 0,
    categories: {
      news: sentiments.map((s, i) => ({
        title: `t-${i}`,
        detail: 'd',
        importance: 2 as const,
        sentiment: s,
      })),
      product: [],
      funding: [],
      hiring: [],
      social: [],
      industryContext: [],
    },
  };
}

describe('computeBrandHealthScore', () => {
  it('returns 50 for each component when no data', () => {
    const result = computeBrandHealthScore({
      selfFindings: [],
      workspaceChanges: [],
      selfCompetitorId: 'self-1',
      momentum: undefined,
      now: NOW,
    });
    expect(result.components.sentiment.score).toBe(50);
    expect(result.components.voice.score).toBe(50);
    expect(result.components.momentum.score).toBe(50);
    expect(result.score).toBe(50);
    expect(result.confidence).toBe('low');
  });

  it('scores all-positive sentiment near 100', () => {
    const result = computeBrandHealthScore({
      selfFindings: [makeFinding(3, ['positive', 'positive', 'positive', 'positive', 'positive'])],
      workspaceChanges: [],
      selfCompetitorId: 'self-1',
      momentum: 'stable',
      now: NOW,
    });
    expect(result.components.sentiment.score).toBe(100);
  });

  it('scores all-negative sentiment near 0', () => {
    const result = computeBrandHealthScore({
      selfFindings: [makeFinding(2, ['negative', 'negative', 'negative'])],
      workspaceChanges: [],
      selfCompetitorId: 'self-1',
      momentum: 'stable',
      now: NOW,
    });
    expect(result.components.sentiment.score).toBe(0);
  });

  it('weights voice by share of workspace mentions', () => {
    const changes: Array<{ competitorId: string; detectedAt: string }> = [];
    // 3 self, 7 competitor → voice should be 30
    for (let i = 0; i < 3; i++)
      changes.push({
        competitorId: 'self-1',
        detectedAt: new Date(NOW.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
      });
    for (let i = 0; i < 7; i++)
      changes.push({
        competitorId: 'comp-1',
        detectedAt: new Date(NOW.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
      });
    const result = computeBrandHealthScore({
      selfFindings: [],
      workspaceChanges: changes,
      selfCompetitorId: 'self-1',
      momentum: 'stable',
      now: NOW,
    });
    expect(result.components.voice.score).toBe(30);
  });

  it('maps momentum enum to fixed buckets', () => {
    const out = ['rising', 'stable', 'slowing', 'declining', 'insufficient-data'].map((m) =>
      computeBrandHealthScore({
        selfFindings: [],
        workspaceChanges: [],
        selfCompetitorId: 'self-1',
        momentum: m as never,
        now: NOW,
      }).components.momentum.score
    );
    expect(out).toEqual([80, 60, 40, 20, 50]);
  });

  it('drops findings outside the 4-week window', () => {
    const result = computeBrandHealthScore({
      selfFindings: [
        // 5 weeks ago — should be ignored
        makeFinding(35, ['negative', 'negative', 'negative']),
      ],
      workspaceChanges: [],
      selfCompetitorId: 'self-1',
      momentum: 'stable',
      now: NOW,
    });
    expect(result.components.sentiment.score).toBe(50);
  });

  it('flags low confidence when mention volume is thin', () => {
    const result = computeBrandHealthScore({
      selfFindings: [makeFinding(1, ['positive', 'neutral'])],
      workspaceChanges: [
        { competitorId: 'self-1', detectedAt: NOW.toISOString() },
        { competitorId: 'comp-1', detectedAt: NOW.toISOString() },
      ],
      selfCompetitorId: 'self-1',
      momentum: 'rising',
      now: NOW,
    });
    expect(result.confidence).toBe('low');
  });
});
