export type PageType = 'pricing' | 'features' | 'homepage' | 'blog' | 'careers';

export type Momentum = 'rising' | 'stable' | 'slowing' | 'declining' | 'insufficient-data';

export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'monitor';

export type PredictedMoveCategory =
  | 'product'
  | 'pricing'
  | 'funding'
  | 'hiring'
  | 'geo'
  | 'strategic';

export type PredictedMoveTimeHorizon = '30d' | '60d' | '90d';

export interface PredictedMove {
  move: string;
  reasoning: string;
  probability: number;
  timeHorizon: PredictedMoveTimeHorizon;
  category: PredictedMoveCategory;
}

export type PredictionStatus =
  | 'pending'
  | 'realized'
  | 'partially-realized'
  | 'expired';

/**
 * A prediction that has been (or is awaiting) evaluation against subsequent
 * research. Stored in `Competitor.predictionHistory` for track-record display.
 */
export interface EvaluatedPrediction {
  move: string;
  reasoning: string;
  probability: number;
  timeHorizon: PredictedMoveTimeHorizon;
  category: PredictedMoveCategory;
  predictedAt: string;          // ISO — when originally predicted
  evaluatedAt: string;          // ISO — when this evaluation ran
  status: PredictionStatus;
  evidence?: string;             // 1-2 sentences explaining realization (or null when pending)
  evidenceUrl?: string;          // citation source URL
}

export interface Competitor {
  id: string;
  userId: string;
  name: string;
  url: string;
  pagesToTrack: PageType[];
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
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
