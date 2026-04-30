export * from './user';
export * from './competitor';
export * from './change';
export * from './subscription';
export * from './research';

/** Standard API response envelope */
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface PaginationMeta {
  cursor?: string;
  hasMore: boolean;
}

/** Pricing tier plan names */
export type PlanTier = 'scout' | 'strategist' | 'command';

/**
 * Plan limits by tier.
 *
 * - `maxCompetitors` / `historyDays` / `researchPerDay` — hard caps enforced at write time.
 * - `monthlyCostCap` — soft Anthropic spend ceiling (USD). Computed from observed
 *   token usage in CloudWatch Logs Insights and rolled into `User.monthToDateCostUsd`
 *   nightly. Once exceeded, `enforceResearchEligibility` rejects further research
 *   until the next month or the user upgrades.
 * - `researchCadenceDaysDefault` — how often the recurring research scheduler
 *   re-runs each competitor when no per-competitor `researchCadenceDays` override
 *   is set on the Competitor record.
 */
export interface PlanLimits {
  maxCompetitors: number;
  historyDays: number;
  researchPerDay: number;
  monthlyCostCap: number;
  researchCadenceDaysDefault: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  scout: {
    maxCompetitors: 3,
    historyDays: 30,
    researchPerDay: 10,
    monthlyCostCap: 5,
    researchCadenceDaysDefault: 7,
  },
  strategist: {
    maxCompetitors: 10,
    historyDays: 90,
    researchPerDay: 30,
    monthlyCostCap: 20,
    researchCadenceDaysDefault: 7,
  },
  command: {
    maxCompetitors: 25,
    historyDays: 365,
    researchPerDay: 100,
    monthlyCostCap: 80,
    researchCadenceDaysDefault: 14,
  },
};

/**
 * Versioned policy identifiers. Bump these when a Privacy Policy / ToS update
 * needs users to re-consent. Frontend should keep a matching constant.
 */
export const TOS_VERSION = '2026-04-30';
export const PRIVACY_VERSION = '2026-04-30';

/** Change types detected by AI analysis */
export type ChangeType = 'pricing' | 'feature' | 'messaging' | 'hiring' | 'content';

/** AI analysis structured output */
export interface AiAnalysis {
  changeType: ChangeType;
  summary: string;
  significanceScore: number;
  strategicImplication: string;
  recommendedAction: string;
}
