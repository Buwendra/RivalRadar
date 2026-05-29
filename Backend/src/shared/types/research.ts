/**
 * 5 base categories captured for every research run plus an industry-aware
 * 6th bucket. The label of `industryContext` changes per User.industry (e.g.
 * "Regulatory & Compliance" for Fintech) and is persisted alongside the
 * finding as `ResearchFinding.industryContextLabel`.
 */
export type ResearchCategory =
  | 'news'
  | 'product'
  | 'funding'
  | 'hiring'
  | 'social'
  | 'industryContext';

export type FindingSentiment = 'positive' | 'neutral' | 'negative';
export type FindingTimeSensitivity = 'breaking' | 'recent' | 'historical';

export interface FindingItem {
  title: string;
  detail: string;
  sourceUrl?: string;
  importance: 1 | 2 | 3;
  sentiment?: FindingSentiment;
  timeSensitivity?: FindingTimeSensitivity;
}

export interface Citation {
  url: string;
  title: string;
  accessedAt: string;
}

export type DerivedStage = 'early' | 'growth' | 'late' | 'public' | 'declining' | 'unknown';
export type DerivedFundingState =
  | 'bootstrapped'
  | 'recently-raised'
  | 'actively-raising'
  | 'runway-concerns'
  | 'public'
  | 'unknown';
export type DerivedHiringState =
  | 'aggressive'
  | 'steady'
  | 'slowing'
  | 'frozen'
  | 'layoffs'
  | 'unknown';
export type DerivedStrategicDirection =
  | 'going-upmarket'
  | 'going-downmarket'
  | 'expanding-geo'
  | 'expanding-vertical'
  | 'specializing'
  | 'diversifying'
  | 'steady'
  | 'unknown';
export type DerivedTechPositioning =
  | 'ai-native'
  | 'ai-adjacent'
  | 'legacy'
  | 'open-source'
  | 'mixed'
  | 'unknown';
export type DerivedPacing = 'shipping-fast' | 'steady' | 'slow' | 'frozen';

export interface DerivedState {
  stage: DerivedStage;
  fundingState: DerivedFundingState;
  hiringState: DerivedHiringState;
  strategicDirection: DerivedStrategicDirection;
  techPositioning: DerivedTechPositioning;
  pacing: DerivedPacing;
  evidenceNotes: string;
}

export interface ResearchFinding {
  id: string;
  competitorId: string;
  userId: string;
  generatedAt: string;
  summary: string;
  categories: Record<ResearchCategory, FindingItem[]>;
  citations: Citation[];
  searchQueries: string[];
  tokensUsed: number;
  derivedState?: DerivedState;
  /**
   * Display label for the `industryContext` category, snapshotted at research
   * time from the user's industry config (e.g. "Regulatory & Compliance"
   * for Fintech). Persisted on the row so historical findings keep their
   * original label even if the user later changes industry. Absent for
   * findings generated when `User.industry` was `Other` or unset.
   */
  industryContextLabel?: string;
}

export type ResearchChangeType = 'pricing' | 'feature' | 'messaging' | 'hiring' | 'content';

export interface ResearchDelta {
  title: string;
  detail: string;
  sourceUrl: string;
  category: ResearchCategory;
  changeType: ResearchChangeType;
  significanceScore: number;
  strategicImplication: string;
  recommendedAction: string;
}
