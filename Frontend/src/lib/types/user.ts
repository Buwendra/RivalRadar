import type { PlanTier } from "./subscription";
import type { NotificationPreferences } from "./integration";

export interface User {
  id: string;
  email: string;
  name: string;
  plan: PlanTier;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
  notificationPreferences?: NotificationPreferences;
  customRecommendationCategories?: string[];
  scheduledReports?: { monthly?: boolean };
  /** Phase 9a — re-consent banner reads these to detect policy-version drift. */
  tosVersion?: string;
  privacyVersion?: string;
  /** Phase 9a — 'restricted' = self-suspended; 'pending-deletion' = mid-deletion. */
  status?: "active" | "restricted" | "pending-deletion";
  /** Phase 7b — workspace-shared feed threshold. 0 = no filter. */
  feedSignificanceThreshold?: number;
  /** Captured at onboarding for AI-call relevance framing. */
  companyName?: string;
  industry?: string;
  /** Phase 23 — Brand Pulse. Seeds the self-brand row. */
  companyWebsite?: string;
}
