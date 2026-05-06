import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { getItem } from '../../../shared/db/queries';
import { subscriptionPK, subscriptionSK } from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const subscription = await getItem<Record<string, unknown>>(subscriptionPK(userId), subscriptionSK());

  if (!subscription) {
    return {
      statusCode: 200,
      body: {
        data: {
          plan: 'scout',
          status: 'free',
          message: 'No active subscription. Using free Scout tier.',
        },
      },
    };
  }

  return {
    statusCode: 200,
    body: {
      data: {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        paddleSubscriptionId: subscription.paddleSubscriptionId,
      },
    },
  };
});
