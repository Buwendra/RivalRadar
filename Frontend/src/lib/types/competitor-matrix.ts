import type { Momentum, ThreatLevel } from "./competitor";

export type DerivedStage =
  | "early"
  | "growth"
  | "late"
  | "public"
  | "declining"
  | "unknown";

export type DerivedFundingState =
  | "bootstrapped"
  | "recently-raised"
  | "actively-raising"
  | "runway-concerns"
  | "public"
  | "unknown";

export type DerivedHiringState =
  | "aggressive"
  | "steady"
  | "slowing"
  | "frozen"
  | "layoffs"
  | "unknown";

export type DerivedStrategicDirection =
  | "going-upmarket"
  | "going-downmarket"
  | "expanding-geo"
  | "expanding-vertical"
  | "specializing"
  | "diversifying"
  | "steady"
  | "unknown";

export type DerivedTechPositioning =
  | "ai-native"
  | "ai-adjacent"
  | "legacy"
  | "open-source"
  | "mixed"
  | "unknown";

export type DerivedPacing = "shipping-fast" | "steady" | "slow" | "frozen";

export interface DerivedState {
  stage: DerivedStage;
  fundingState: DerivedFundingState;
  hiringState: DerivedHiringState;
  strategicDirection: DerivedStrategicDirection;
  techPositioning: DerivedTechPositioning;
  pacing: DerivedPacing;
  evidenceNotes: string;
}

export interface CompetitorMatrixRow {
  id: string;
  name: string;
  url: string;
  status: "active" | "paused";
  threatLevel?: ThreatLevel;
  threatReasoning?: string;
  momentum?: Momentum;
  momentumChangePercent?: number;
  derivedTags?: string[];
  derivedState?: DerivedState;
  latestResearchAt?: string;
}
