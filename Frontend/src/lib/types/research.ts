export type ResearchCategory = "news" | "product" | "funding" | "hiring" | "social";

export interface FindingItem {
  title: string;
  detail: string;
  sourceUrl?: string;
  importance: 1 | 2 | 3;
}

export interface Citation {
  url: string;
  title: string;
  accessedAt: string;
}

export interface ResearchFinding {
  id: string;
  competitorId: string;
  userId: string;
  generatedAt: string;
  summary: string;
  categories: Record<ResearchCategory, FindingItem[]>;
  citations: Citation[];
  searchQueries: string[];
  tokensUsed: number;
}
