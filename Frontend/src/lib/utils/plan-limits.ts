import type { PlanTier } from "@/lib/types";

export const PLAN_LIMITS: Record<PlanTier, { maxCompetitors: number; historyDays: number }> = {
  scout: { maxCompetitors: 3, historyDays: 30 },
  strategist: { maxCompetitors: 10, historyDays: 90 },
  command: { maxCompetitors: 25, historyDays: 365 },
};
