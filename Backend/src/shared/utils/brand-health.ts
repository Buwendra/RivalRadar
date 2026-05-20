/**
 * Phase 24 — Brand Health Score. Pure aggregation. No AI cost.
 *
 * Three components, each 0–100, equal-weighted into a composite score:
 *   - sentiment: external tone of self-brand findings over the last 4 weeks
 *   - voice: share of all workspace coverage attributable to self-brand
 *   - momentum: bucketed from the rule-based momentum enum already on the row
 *
 * Composite = round((sentiment + voice + momentum) / 3).
 *
 * `confidence` is a coarse signal-strength hint based on total mention volume
 * — surfaces a UI badge ("low data") rather than implying false precision when
 * a brand has barely been researched.
 */

import type {
  ResearchFinding,
  ResearchCategory,
  FindingItem,
  FindingSentiment,
  Momentum,
} from '../types';

const SENTIMENT_WINDOW_WEEKS = 4;
const VOICE_WINDOW_WEEKS = 4;

export type HealthConfidence = 'low' | 'medium' | 'high';

export interface BrandHealthComponent {
  /** 0–100, integer. */
  score: number;
  /** Human-readable one-line explanation surfaced in the UI tooltip. */
  detail: string;
}

export interface BrandHealthScore {
  /** Composite 0–100, integer. */
  score: number;
  components: {
    sentiment: BrandHealthComponent;
    voice: BrandHealthComponent;
    momentum: BrandHealthComponent;
  };
  confidence: HealthConfidence;
  asOf: string;
}

const MOMENTUM_SCORE: Record<Momentum, number> = {
  rising: 80,
  stable: 60,
  slowing: 40,
  declining: 20,
  'insufficient-data': 50,
};

export interface BrandHealthInput {
  /** Self-brand ResearchFinding records. Order does not matter. */
  selfFindings: ResearchFinding[];
  /** All Change records in the workspace (self + competitors). */
  workspaceChanges: Array<{ competitorId: string; detectedAt: string }>;
  /** The self-brand Competitor row id. */
  selfCompetitorId: string;
  /** Current self-brand momentum from the Competitor row enrichment. */
  momentum: Momentum | undefined;
  /** Optional clock override for deterministic tests. */
  now?: Date;
}

export function computeBrandHealthScore(input: BrandHealthInput): BrandHealthScore {
  const now = input.now ?? new Date();
  const asOf = now.toISOString();

  const sentiment = computeSentimentComponent(input.selfFindings, now);
  const voice = computeVoiceComponent(
    input.workspaceChanges,
    input.selfCompetitorId,
    now
  );
  const momentum = computeMomentumComponent(input.momentum);

  const composite = Math.round(
    (sentiment.score + voice.score + momentum.score) / 3
  );

  return {
    score: composite,
    components: { sentiment, voice, momentum },
    confidence: computeConfidence({
      sentimentTotal: parseTotal(sentiment.detail),
      voiceTotal: parseTotal(voice.detail),
    }),
    asOf,
  };
}

function parseTotal(detail: string): number {
  const m = detail.match(/(\d+)\s+mention/);
  return m ? Number(m[1]) : 0;
}

function computeSentimentComponent(
  findings: ResearchFinding[],
  now: Date
): BrandHealthComponent {
  const cutoff = now.getTime() - SENTIMENT_WINDOW_WEEKS * 7 * 24 * 60 * 60 * 1000;
  let positive = 0;
  let negative = 0;
  let neutral = 0;

  for (const f of findings) {
    const ts = Date.parse(f.generatedAt);
    if (isNaN(ts) || ts < cutoff) continue;
    const cats = (f.categories ?? {}) as Partial<Record<ResearchCategory, FindingItem[]>>;
    for (const items of Object.values(cats)) {
      for (const item of items ?? []) {
        const s = item.sentiment as FindingSentiment | undefined;
        if (s === 'positive') positive++;
        else if (s === 'negative') negative++;
        else if (s === 'neutral') neutral++;
      }
    }
  }

  const total = positive + negative + neutral;
  if (total === 0) {
    return {
      score: 50,
      detail: '0 mentions in the last 4 weeks — neutral default.',
    };
  }
  const raw = 50 + 50 * ((positive - negative) / total);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return {
    score,
    detail: `${total} mention${total === 1 ? '' : 's'}: ${positive} positive, ${neutral} neutral, ${negative} negative.`,
  };
}

function computeVoiceComponent(
  changes: BrandHealthInput['workspaceChanges'],
  selfCompetitorId: string,
  now: Date
): BrandHealthComponent {
  const cutoff = now.getTime() - VOICE_WINDOW_WEEKS * 7 * 24 * 60 * 60 * 1000;
  let total = 0;
  let selfCount = 0;
  for (const c of changes) {
    const ts = Date.parse(c.detectedAt);
    if (isNaN(ts) || ts < cutoff) continue;
    total++;
    if (c.competitorId === selfCompetitorId) selfCount++;
  }
  if (total === 0) {
    return {
      score: 50,
      detail: '0 mentions across the workspace in the last 4 weeks.',
    };
  }
  const score = Math.round((selfCount / total) * 100);
  return {
    score,
    detail: `${selfCount} of ${total} workspace mention${total === 1 ? '' : 's'} were about you.`,
  };
}

function computeMomentumComponent(m: Momentum | undefined): BrandHealthComponent {
  const key: Momentum = m ?? 'insufficient-data';
  return {
    score: MOMENTUM_SCORE[key],
    detail: momentumDetail(key),
  };
}

function momentumDetail(m: Momentum): string {
  switch (m) {
    case 'rising':
      return 'Coverage volume is trending up week over week.';
    case 'stable':
      return 'Coverage volume is steady.';
    case 'slowing':
      return 'Coverage volume is trending down.';
    case 'declining':
      return 'Coverage volume has dropped sharply.';
    case 'insufficient-data':
      return 'Not enough data yet to compute momentum.';
  }
}

function computeConfidence(input: {
  sentimentTotal: number;
  voiceTotal: number;
}): HealthConfidence {
  const min = Math.min(input.sentimentTotal, input.voiceTotal);
  if (min >= 20) return 'high';
  if (min >= 5) return 'medium';
  return 'low';
}
