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
}
