import { PlanTier } from './index';

export type AccountStatus = 'active' | 'restricted' | 'pending-deletion';

export interface User {
  id: string;
  email: string;
  name: string;
  plan: PlanTier;
  cognitoSub: string;
  paddleCustomerId?: string;
  onboardingComplete: boolean;
  companyName?: string;
  industry?: string;
  createdAt: string;
  updatedAt: string;

  // Account lifecycle / compliance
  status?: AccountStatus;            // default 'active' if absent
  tosVersion?: string;                // version of ToS the user accepted
  tosAcceptedAt?: string;             // ISO timestamp of acceptance
  privacyVersion?: string;            // version of Privacy Policy the user accepted
  privacyAcceptedAt?: string;         // ISO timestamp of acceptance

  // Misuse-defense rate limiting (resets daily at UTC midnight)
  researchCountDay?: number;          // count of research calls in current 24h window
  researchCountResetAt?: string;      // ISO timestamp when the counter next resets

  // Per-user Anthropic cost observability + monthly cap (Phase 1).
  // `monthToDateCostUsd` is a denormalized cache written nightly by the
  // `aggregate-ai-costs` Lambda from `ai_call_completed` log events. It's not
  // strictly real-time — the daily eligibility gate combines it with the
  // hard-cap from PLAN_LIMITS.monthlyCostCap to fail-closed on runaway usage.
  monthToDateCostUsd?: number;
  monthToDateCostMonth?: string;      // 'YYYY-MM' — used to detect month rollover
  monthlyTokenBudget?: number;        // optional override of tier-level cap (null = use tier default)
}

/**
 * `CostDay` — daily Anthropic cost rollup per user. Written by the nightly
 * `aggregate-ai-costs` Lambda from `ai_call_completed` log lines.
 *
 * - `PK = USER#<id>`, `SK = COST#<YYYY-MM-DD>`
 * - `totalCostUsd` is the sum across all opNames for that day
 * - `byOpName` is denormalized so the dashboard doesn't have to re-derive it
 * - `expiresAt` (epoch seconds) drives DynamoDB TTL — 90-day retention
 */
export interface CostDay {
  date: string;                       // YYYY-MM-DD
  userId: string;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byOpName: Record<string, {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  expiresAt: number;                  // epoch seconds — DynamoDB TTL
}
