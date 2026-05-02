/**
 * Recommendation — strategic action a user should consider taking in response
 * to recent competitor activity. Generated weekly during the digest pipeline
 * (one Sonnet call per user, ~$0.05/user/week) and stored as immutable rows.
 *
 * - `PK = USER#<userId>`, `SK = REC#<createdAt>` (combined feed via GSI1)
 * - `triggeringChangeIds` references the Change records that motivated the rec.
 * - `competitorId` is optional — recommendations can reference a single
 *   competitor OR a cross-portfolio pattern.
 * - `status` evolves via PATCH /recommendations/{id}: open → dismissed | acted-on.
 *   Recommendations themselves are immutable; only the status + dismissedAt /
 *   actedAt fields change.
 */

export type RecommendationCategory =
  | 'positioning'
  | 'pricing'
  | 'messaging'
  | 'product'
  | 'sales'
  | 'talent';

export type RecommendationEffortLevel = 'low' | 'medium' | 'high';

export type RecommendationTimeHorizon =
  | 'this-week'
  | 'this-month'
  | 'this-quarter';

export type RecommendationStatus = 'open' | 'dismissed' | 'acted-on';

export interface Recommendation {
  id: string;
  userId: string;
  competitorId?: string;
  competitorName?: string;          // denormalized for cheap UI rendering
  triggeringChangeIds: string[];
  category: RecommendationCategory;
  title: string;
  body: string;                     // markdown / plain text
  effortLevel: RecommendationEffortLevel;
  timeHorizon: RecommendationTimeHorizon;
  confidence: number;               // 0–1
  status: RecommendationStatus;
  createdAt: string;
  dismissedAt?: string;
  actedAt?: string;
}
