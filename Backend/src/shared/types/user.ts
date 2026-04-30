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
}
