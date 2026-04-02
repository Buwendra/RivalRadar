import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { getItem, queryGSI } from '../../../shared/db/queries';
import { subscriptionPK, subscriptionSK } from '../../../shared/db/keys';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

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
