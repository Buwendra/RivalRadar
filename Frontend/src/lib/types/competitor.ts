export type PageType = "pricing" | "features" | "homepage" | "blog" | "careers";

export interface Competitor {
  id: string;
  name: string;
  url: string;
  pagesToTrack: PageType[];
  status: "active" | "paused";
  createdAt: string;
}

export interface CompetitorDetail extends Competitor {
  recentChanges: Array<{
    id: string;
    significance: number;
    aiAnalysis: AiAnalysis;
    detectedAt: string;
  }>;
  recentResearch: ResearchFinding[];
}

import type { AiAnalysis } from "./change";
import type { ResearchFinding } from "./research";
