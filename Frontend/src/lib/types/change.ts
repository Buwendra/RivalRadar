export type ChangeType = "pricing" | "feature" | "messaging" | "hiring" | "content";

export interface AiAnalysis {
  changeType: ChangeType;
  summary: string;
  significanceScore: number;
  strategicImplication: string;
  recommendedAction: string;
}

export interface Change {
  id: string;
  competitorId: string;
  competitorName?: string;
  pageUrl: string;
  significance: number;
  aiAnalysis: AiAnalysis;
  detectedAt: string;
}

export interface ChangeDetail extends Change {
  diffSummary: string;
  feedbackHelpful?: boolean;
}

export interface ChangeFilters {
  cursor?: string;
  limit?: number;
  minSignificance?: number;
  competitorId?: string;
}
