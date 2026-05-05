import { apiClient } from "./client";
import type { User, PageType, NotificationPreferences } from "@/lib/types";

export interface OnboardInput {
  companyName: string;
  industry: string;
  competitors: Array<{
    name: string;
    url: string;
    pagesToTrack: PageType[];
  }>;
  tosVersion?: string;
  privacyVersion?: string;
}

export interface OnboardResponse {
  message: string;
  competitorIds: string[];
}

export const usersApi = {
  getProfile: () => apiClient<User>("/users/me"),

  updateProfile: (data: {
    name?: string;
    notificationPreferences?: NotificationPreferences;
    customRecommendationCategories?: string[];
    scheduledReports?: { monthly?: boolean };
  }) =>
    apiClient<{ message: string }>("/users/me", {
      method: "PUT",
      body: data,
    }),

  onboard: (data: OnboardInput) =>
    apiClient<OnboardResponse>("/users/onboard", {
      method: "POST",
      body: data,
    }),

  /**
   * Phase 8a — bumps server-side `lastLoginAt`. Called once per session from
   * the dashboard layout's mount effect (sessionStorage-guarded). Used by
   * the retention-nudge cron to identify users who haven't returned in 7+ days.
   */
  ping: () =>
    apiClient<{ pinged: boolean }>("/users/me/ping", {
      method: "POST",
      body: {},
    }),
};
