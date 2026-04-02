import { PlanTier } from './index';

export interface Subscription {
  userId: string;
  paddleSubscriptionId: string;
  paddleCustomerId: string;
  plan: PlanTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
  currentPeriodEnd: string;
}
