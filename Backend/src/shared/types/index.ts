export * from './user';
export * from './competitor';
export * from './change';
export * from './subscription';

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
export const PLAN_LIMITS: Record<PlanTier, { maxCompetitors: number; historyDays: number }> = {
  scout: { maxCompetitors: 3, historyDays: 30 },
  strategist: { maxCompetitors: 10, historyDays: 90 },
  command: { maxCompetitors: 25, historyDays: 365 },
};

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
