import type { PlanTier } from "./subscription";

export interface User {
  id: string;
  email: string;
  name: string;
  plan: PlanTier;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}
