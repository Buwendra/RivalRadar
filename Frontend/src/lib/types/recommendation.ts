// Mirror of Backend/src/shared/types/recommendation.ts
// Backend is the source of truth; this is for client typing.

export type RecommendationCategory =
  | "positioning"
  | "pricing"
  | "messaging"
  | "product"
  | "sales"
  | "talent";

export type RecommendationEffortLevel = "low" | "medium" | "high";

export type RecommendationTimeHorizon =
  | "this-week"
  | "this-month"
  | "this-quarter";

export type RecommendationStatus = "open" | "dismissed" | "acted-on";

export interface Recommendation {
  id: string;
  userId: string;
  competitorId?: string;
  competitorName?: string;
  triggeringChangeIds: string[];
  category: RecommendationCategory;
  title: string;
  body: string;
  effortLevel: RecommendationEffortLevel;
  timeHorizon: RecommendationTimeHorizon;
  confidence: number;
  status: RecommendationStatus;
  createdAt: string;
  dismissedAt?: string;
  actedAt?: string;
}
