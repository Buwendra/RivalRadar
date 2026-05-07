export interface BattlecardSummary {
  id: string;
  competitorId: string;
  competitorName: string;
  publicToken: string;
  shareUrl: string;
  filename: string;
  pdfBytes: number;
  expiresAt: number;
  createdAt: string;
  revokedAt?: string;
}
