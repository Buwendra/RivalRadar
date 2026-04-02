import { AiAnalysis } from './index';

export interface Change {
  id: string;
  competitorId: string;
  userId: string;
  snapshotId: string;
  pageUrl: string;
  diffSummary: string;
  significance: number;
  aiAnalysis: AiAnalysis;
  feedbackHelpful?: boolean;
  detectedAt: string;
}
