export type ResearchCategory =
  | "news"
  | "product"
  | "funding"
  | "hiring"
  | "social"
  | "industryContext";

export interface FindingItem {
  title: string;
  detail: string;
  sourceUrl?: string;
  importance: 1 | 2 | 3;
}

export interface Citation {
  url: string;
  title: string;
  /** When Kironyx read the source (always present). */
  accessedAt: string;
  /** The source's own publication date, when it exposes a usable one. */
  publishedAt?: string;
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
  /**
   * Per-user-industry label for the `industryContext` category, snapshotted
   * at research time. Falls back to "Industry Context" when absent (legacy
   * findings or User.industry was "Other" / unset).
   */
  industryContextLabel?: string;
}
