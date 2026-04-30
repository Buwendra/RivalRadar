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

/** Plan limits by tier */
export const PLAN_LIMITS: Record<PlanTier, { maxCompetitors: number; historyDays: number; researchPerDay: number }> = {
  scout: { maxCompetitors: 3, historyDays: 30, researchPerDay: 10 },
  strategist: { maxCompetitors: 10, historyDays: 90, researchPerDay: 30 },
  command: { maxCompetitors: 25, historyDays: 365, researchPerDay: 100 },
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
