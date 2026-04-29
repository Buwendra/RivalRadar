export type PageType = "pricing" | "features" | "homepage" | "blog" | "careers";

export type Momentum =
  | "rising"
  | "stable"
  | "slowing"
  | "declining"
  | "insufficient-data";

export type ThreatLevel = "critical" | "high" | "medium" | "low" | "monitor";

export type PredictedMoveCategory =
  | "product"
  | "pricing"
  | "funding"
  | "hiring"
  | "geo"
  | "strategic";

export type PredictedMoveTimeHorizon = "30d" | "60d" | "90d";

export interface PredictedMove {
  move: string;
  reasoning: string;
  probability: number;
  timeHorizon: PredictedMoveTimeHorizon;
  category: PredictedMoveCategory;
}

export type PredictionStatus =
  | "pending"
  | "realized"
  | "partially-realized"
  | "expired";

export interface EvaluatedPrediction {
  move: string;
  reasoning: string;
  probability: number;
  timeHorizon: PredictedMoveTimeHorizon;
  category: PredictedMoveCategory;
  predictedAt: string;
  evaluatedAt: string;
  status: PredictionStatus;
  evidence?: string;
  evidenceUrl?: string;
}

export interface Competitor {
  id: string;
  name: string;
  url: string;
  pagesToTrack: PageType[];
  status: "active" | "paused";
  createdAt: string;
  momentum?: Momentum;
  momentumChangePercent?: number;
  momentumAsOf?: string;
  threatLevel?: ThreatLevel;
  threatReasoning?: string;
  threatAsOf?: string;
  derivedTags?: string[];
  derivedTagsAsOf?: string;
  predictedMoves?: PredictedMove[];
  predictedMovesAsOf?: string;
  predictionHistory?: EvaluatedPrediction[];
  predictionHistoryAsOf?: string;
}

export interface CompetitorDetailChange {
  id: string;
  significance: number;
  pageUrl?: string;
  aiAnalysis: AiAnalysis;
  detectedAt: string;
  researchId?: string;
  sourceCategory?: ResearchCategory;
}

export interface CompetitorStats {
  changes7d: number;
  changes30d: number;
  highSignificance30d: number;
  lastChangeAt: string | null;
  lastResearchAt: string | null;
  changesByPage: Partial<Record<PageType, number>>;
  changesByType: Partial<Record<ChangeType, number>>;
  changesByDay: Array<{ date: string; count: number }>;
}

export interface CompetitorDetail extends Competitor {
  recentChanges: CompetitorDetailChange[];
  recentResearch: ResearchFinding[];
  stats: CompetitorStats;
}

import type { AiAnalysis, ChangeType } from "./change";
import type { ResearchFinding, ResearchCategory } from "./research";
