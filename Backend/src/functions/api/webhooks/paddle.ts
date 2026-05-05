import {
  EventName,
  SubscriptionCreatedNotification,
  SubscriptionNotification,
  TransactionNotification,
} from '@paddle/paddle-node-sdk';
import { apiHandler, HttpError, PublicEvent } from '../../../shared/middleware/handler';
import { getItem, putItem, putItemIfNotExists, updateItem } from '../../../shared/db/queries';
import {
  cancelFeedbackPK,
  cancelFeedbackSK,
  subscriptionPK,
  subscriptionSK,
  userPK,
  userSK,
} from '../../../shared/db/keys';
import { verifyPaddleWebhook } from '../../../shared/services/paddle';
import { sendEmail } from '../../../shared/services/ses';
import { generateId } from '../../../shared/utils/id';
import { PlanTier } from '../../../shared/types';
import type { CancellationFeedback, User } from '../../../shared/types';
import { logger } from '../../../shared/utils/logger';

const SURVEY_TTL_DAYS = 30;

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

      const now = new Date();

      await updateItem(subscriptionPK(userId), subscriptionSK(), {
        status: 'canceled',
        updatedAt: now.toISOString(),
      });

      // Load the user record so we know which plan they were on (for the
      // analytics) and where to send the survey email. We do this BEFORE the
      // downgrade so we capture the canceled tier, not 'scout'.
      const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
      const canceledPlan: PlanTier = (user?.plan as PlanTier | undefined) ?? 'scout';

      await updateItem(userPK(userId), userSK(), {
        plan: 'scout',
        updatedAt: now.toISOString(),
      });

      logger.info('subscription_canceled', { userId, subId: sub.id, canceledPlan });

      // Phase 8b — best-effort exit-survey email. Generate an opaque ULID
      // token, persist a CancellationFeedback row keyed by it, then email
      // a one-click survey link. Best-effort — survey-email failures must
      // not unwind the cancellation processing.
      if (user?.email) {
        try {
          const token = generateId();
          const expiresAtSec =
            Math.floor(now.getTime() / 1000) + SURVEY_TTL_DAYS * 24 * 60 * 60;
          const row: CancellationFeedback = {
            token,
            userId,
            email: user.email,
            plan: canceledPlan,
            paddleSubscriptionId: sub.id,
            createdAt: now.toISOString(),
            expiresAt: expiresAtSec,
          };
          await putItem({
            PK: cancelFeedbackPK(token),
            SK: cancelFeedbackSK(),
            ...row,
          });

          const surveyUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/cancellation-survey/${token}`;
          await sendEmail(
            user.email,
            'Sorry to see you go — 30 seconds to help us improve?',
            `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
                <div style="padding: 24px 28px;">
                  <p>Hi ${user.name ?? 'there'},</p>
                  <p>We noticed you canceled your RivalScan ${canceledPlan} subscription. We'd love to know why so we can do better for the next person.</p>
                  <p>30 seconds to fill in — no follow-up sales pitch:</p>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="${surveyUrl}" style="background: #2563eb; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                      Tell us why
                    </a>
                  </div>
                  <p style="color: #6b7280; font-size: 12px;">
                    The link expires in 30 days. If you change your mind, you can resubscribe anytime in your dashboard.
                  </p>
                </div>
              </div>
            `
          );
          logger.info('cancellation_survey_sent', { userId, token, plan: canceledPlan });
        } catch (err) {
          logger.warn('cancellation_survey_send_failed', {
            userId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

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
