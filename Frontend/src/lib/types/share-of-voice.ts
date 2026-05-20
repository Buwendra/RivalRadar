/**
 * Phase 24 — Share of Voice types. Mirrors the backend `ShareOfVoiceResult`.
 */

import type { ResearchCategory } from "./research";

export interface SoVRow {
  competitorId: string;
  name: string;
  isSelf: boolean;
  count: number;
  percent: number;
}

export interface ShareOfVoiceWindow {
  start: string;
  end: string;
  days: number;
}

export interface ShareOfVoiceResponse {
  window: ShareOfVoiceWindow;
  totalChanges: number;
  overall: SoVRow[];
  byCategory: Record<ResearchCategory, SoVRow[]>;
}

export type ShareOfVoiceWindowKey = "7d" | "30d" | "90d";
