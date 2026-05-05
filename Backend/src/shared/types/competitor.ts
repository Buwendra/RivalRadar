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

  // Recurring research cadence (Phase 1). `researchCadenceDays` overrides the
  // tier-level default from PLAN_LIMITS.researchCadenceDaysDefault. Null/absent
  // means use the tier default. `lastRecurringResearchAt` is set by the
  // recurring-research enqueuer Lambda after each scheduled run, used to skip
  // competitors whose latest run is still fresh.
  researchCadenceDays?: number;
  lastRecurringResearchAt?: string;

  // Snooze (Phase 7a). When set + in the future, the competitor is fully
  // silenced: recurring research skips it, aggregate-changes filters out
  // its changes from the weekly digest, real-time critical alerts are
  // suppressed, and the dashboard hides changes from this competitor by
  // default. Auto-expires at `snoozedUntil`. Set to null/undefined to
  // un-snooze. `snoozedAt` records when the snooze started for forensic
  // logging + a future "snooze history" view.
  snoozedUntil?: string;
  snoozedAt?: string;
}
