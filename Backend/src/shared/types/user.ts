import { PlanTier } from './index';

export interface User {
  id: string;
  email: string;
  name: string;
  plan: PlanTier;
  cognitoSub: string;
  paddleCustomerId?: string;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}
