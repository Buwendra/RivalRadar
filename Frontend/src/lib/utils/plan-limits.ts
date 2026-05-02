import type { PlanTier } from "@/lib/types";

// Mirror of the backend `PlanLimits` interface from
// `Backend/src/shared/types/index.ts`. Values must match exactly — the
// backend is the enforcement source of truth, the frontend is for display
// (count headers, upgrade nudges, history depth charts).
export const PLAN_LIMITS: Record<PlanTier, {
  maxCompetitors: number;
  historyDays: number;
  researchPerDay: number;
  monthlyCostCap: number;
  researchCadenceDaysDefault: number;
}> = {
  scout: {
    maxCompetitors: 3,
    historyDays: 30,
    researchPerDay: 10,
    monthlyCostCap: 5,
    researchCadenceDaysDefault: 7,
  },
  strategist: {
    maxCompetitors: 10,
    historyDays: 90,
    researchPerDay: 30,
    monthlyCostCap: 20,
    researchCadenceDaysDefault: 7,
  },
  command: {
    maxCompetitors: 25,
    historyDays: 365,
    researchPerDay: 100,
    monthlyCostCap: 80,
    researchCadenceDaysDefault: 14,
  },
};
