import {
  EventName,
  SubscriptionCreatedNotification,
  SubscriptionNotification,
  TransactionNotification,
} from '@paddle/paddle-node-sdk';
import { apiHandler, HttpError, PublicEvent } from '../../../shared/middleware/handler';
import { putItemIfNotExists, updateItem } from '../../../shared/db/queries';
import { subscriptionPK, subscriptionSK, userPK, userSK } from '../../../shared/db/keys';
import { verifyPaddleWebhook } from '../../../shared/services/paddle';
import { sendEmail } from '../../../shared/services/ses';
import { PlanTier } from '../../../shared/types';
import { logger } from '../../../shared/utils/logger';

function getRawBody(event: PublicEvent): string {
  return event.isBase64Encoded
    ? Buffer.from(event.body!, 'base64').toString()
    : event.body!;
}

export const handler = apiHandler<PublicEvent>(async (event) => {
  const rawBody = getRawBody(event);
  const signature = event.headers['paddle-signature'];
  if (!signature) throw new HttpError(400, 'MISSING_SIGNATURE', 'Missing Paddle-Signature header');

  const isValid = await verifyPaddleWebhook(rawBody, signature);
  if (!isValid) throw new HttpError(400, 'INVALID_SIGNATURE', 'Invalid Paddle webhook signature');

  const payload = JSON.parse(rawBody) as { event_type: string; data: Record<string, unknown> };
  const eventType = payload.event_type;

  logger.info('Paddle webhook received', { type: eventType });

  switch (eventType) {
    case EventName.SubscriptionCreated: {
      const sub = payload.data as unknown as SubscriptionCreatedNotification;
      const customData = sub.customData as { userId?: string; plan?: string } | null;
      const userId = customData?.userId;
      const plan = customData?.plan as PlanTier | undefined;

      if (!userId || !plan) {
        logger.warn('subscription.created missing customData', { subId: sub.id });
        break;
      }

      const currentPeriodEnd = sub.currentBillingPeriod?.endsAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Idempotent — won't duplicate if Paddle retries
      await putItemIfNotExists({
        PK: subscriptionPK(userId),
        SK: subscriptionSK(),
        userId,
        paddleSubscriptionId: sub.id,
        paddleCustomerId: sub.customerId,
        plan,
        status: 'active',
        currentPeriodEnd,
        createdAt: new Date().toISOString(),
      });

      await updateItem(userPK(userId), userSK(), {
        plan,
        paddleCustomerId: sub.customerId,
        updatedAt: new Date().toISOString(),
      });

      logger.info('Subscription created in DB', { userId, plan, subId: sub.id });
      break;
    }

    case EventName.SubscriptionUpdated: {
      const sub = payload.data as unknown as SubscriptionNotification;
      const customData = sub.customData as { userId?: string } | null;
      const userId = customData?.userId;

      if (!userId) {
        logger.warn('subscription.updated missing customData.userId', { subId: sub.id });
        break;
      }

      const status = sub.status as 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
      const currentPeriodEnd = sub.currentBillingPeriod?.endsAt ?? undefined;

      const subUpdates: Record<string, unknown> = {
        status,
        updatedAt: new Date().toISOString(),
      };
      if (currentPeriodEnd) subUpdates.currentPeriodEnd = currentPeriodEnd;

      await updateItem(subscriptionPK(userId), subscriptionSK(), subUpdates);

      // If subscription is now canceled or past_due, downgrade user plan
      if (status === 'canceled') {
        await updateItem(userPK(userId), userSK(), {
          plan: 'scout',
          updatedAt: new Date().toISOString(),
        });
      }

      logger.info('Subscription updated in DB', { userId, status, subId: sub.id });
      break;
    }

    case EventName.SubscriptionCanceled: {
      const sub = payload.data as unknown as SubscriptionNotification;
      const customData = sub.customData as { userId?: string } | null;
      const userId = customData?.userId;

      if (!userId) {
        logger.warn('subscription.canceled missing customData.userId', { subId: sub.id });
        break;
      }

      await updateItem(subscriptionPK(userId), subscriptionSK(), {
        status: 'canceled',
        updatedAt: new Date().toISOString(),
      });

      await updateItem(userPK(userId), userSK(), {
        plan: 'scout',
        updatedAt: new Date().toISOString(),
      });

      logger.info('Subscription canceled, user downgraded to scout', { userId, subId: sub.id });
      break;
    }

    case EventName.TransactionPaymentFailed: {
      const txn = payload.data as unknown as TransactionNotification;
      const customData = txn.customData as { userId?: string } | null;
      const userId = customData?.userId;

      if (userId) {
        await updateItem(subscriptionPK(userId), subscriptionSK(), {
          status: 'past_due',
          updatedAt: new Date().toISOString(),
        });
      }

      // Attempt to notify user — don't fail the webhook if email fails
      const userEmail = (txn as unknown as Record<string, unknown>).customerEmail as string | undefined;
      if (userEmail) {
        try {
          await sendEmail(
            userEmail,
            'Action required: Payment failed for your RivalScan subscription',
            `<p>Hi,</p><p>We were unable to process your RivalScan subscription payment. Please update your payment method in your <a href="${process.env.FRONTEND_URL}/dashboard/settings">billing settings</a> to avoid service interruption.</p>`
          );
        } catch (emailErr) {
          logger.error('Failed to send payment failure email', { error: emailErr, userEmail });
        }
      }

      logger.warn('Transaction payment failed', { txnId: txn.id, userId });
      break;
    }

    default:
      logger.info('Unhandled Paddle webhook event', { type: eventType });
  }

  return {
    statusCode: 200,
    body: { data: { received: true } },
  };
});
