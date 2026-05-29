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
  /** Phase 8a — current session anchor; bumped by the once-per-session ping. */
  lastLoginAt?: string;
  /**
   * Phase 8a — the value of `lastLoginAt` *before* the current session's ping.
   * Powers the "since you last looked" dashboard hero card. Undefined on a
   * user's first-ever session.
   */
  previousLoginAt?: string;
  /**
   * Phase 2 demo-wow — latest weekly audio briefing (Strategist+). Absent
   * on Scout or when no briefing has been generated for this workspace yet.
   * The URL is a 7-day presigned S3 link; the profile handler re-mints on
   * the fly if the stored one is near expiry.
   */
  audioBriefing?: {
    url: string;
    durationSec: number;
    generatedAt: string;
  };
}
