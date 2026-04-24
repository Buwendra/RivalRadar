import { AiAnalysis } from './index';
import type { Citation, ResearchCategory } from './research';

export interface Change {
  id: string;
  competitorId: string;
  userId: string;
  snapshotId?: string;
  pageUrl: string;
  diffSummary: string;
  significance: number;
  aiAnalysis: AiAnalysis;
  feedbackHelpful?: boolean;
  detectedAt: string;
  researchId?: string;
  citations?: Citation[];
  sourceCategory?: ResearchCategory;
}
