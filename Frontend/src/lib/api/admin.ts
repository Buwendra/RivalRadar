import { apiClient } from "./client";

export interface AdminBusinessSnapshot {
  asOf: string;
  mrrUsd: number;
  arrUsd: number;
  mrrByTier: {
    scout: { count: number; mrrUsd: number };
    strategist: { count: number; mrrUsd: number };
    command: { count: number; mrrUsd: number };
  };
  activeSubscriptions: number;
  canceledLast30Days: number;
  churnRatePercent: number;
  ai30dSpendUsd: number;
  grossMarginUsd: number;
  topCostUsers: Array<{ userId: string; email?: string; costUsd: number }>;
  recentCancellations: Array<{
    plan: string;
    reason: string;
    freeText?: string;
    submittedAt: string;
  }>;
}

export const adminApi = {
  business: () => apiClient<AdminBusinessSnapshot>("/admin/business"),
};
