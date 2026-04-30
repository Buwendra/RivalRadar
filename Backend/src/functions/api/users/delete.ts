/**
 * GDPR Art. 17 (Right to Erasure / "Right to be Forgotten") +
 * CCPA §1798.105 (Right to Delete).
 *
 * Hard-deletes all user data within the request. Sequence is designed to
 * leave the system in a recoverable state even if a step fails halfway:
 *
 *   1. Mark User as 'pending-deletion' atomically — blocks concurrent
 *      operations from this user during the wipe
 *   2. Best-effort cancel Paddle subscription (logged on failure; data
 *      deletion proceeds anyway because GDPR mandates the deletion timeline,
 *      not the billing timeline)
 *   3. Hard-delete all Competitor + Change + ResearchFinding records
 *   4. Delete Subscription record
 *   5. Delete User record
 *   6. Delete Cognito user (signals all sessions; stops re-auth)
 *   7. Send confirmation email with deletion certificate
 *
 * This Lambda needs cognito-idp:AdminDeleteUser permission, granted at the
 * CDK route registration (Backend/lib/stacks/api.stack.ts).
 */
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  apiHandler,
  getUserEmail,
  HttpError,
} from '../../../shared/middleware/handler';
import {
  getItem,
  queryByPK,
  queryGSI,
  deleteItem,
  updateItem,
} from '../../../shared/db/queries';
import {
  userPK,
  userSK,
  competitorPK,
  competitorSK,
  subscriptionPK,
  subscriptionSK,
} from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { logger } from '../../../shared/utils/logger';
import { sendEmail } from '../../../shared/services/ses';
import { getPaddleClient } from '../../../shared/services/paddle';

const cognito = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID!;

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const deletionId = generateId();
  const requestedAt = new Date().toISOString();

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const user = await getItem<Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  // Idempotency guard
  if (user.status === 'pending-deletion') {
    throw new HttpError(
      409,
      'DELETION_IN_PROGRESS',
      'Account deletion is already in progress.'
    );
  }

  // 1. Mark for deletion (blocks concurrent operations)
  await updateItem(userPK(userId), userSK(), {
    status: 'pending-deletion',
    updatedAt: requestedAt,
  });

  logger.info('user_deletion_started', { userId, deletionId, email });

  // 2. Best-effort Paddle cancellation
  let paddleCancelled = false;
  let paddleError: string | undefined;
  const paddleCustomerId = user.paddleCustomerId as string | undefined;
  if (paddleCustomerId) {
    try {
      const paddle = await getPaddleClient();
      // List active subscriptions for this customer and cancel each.
      // Paddle SDK returns paginated results; iterate to ensure all are caught.
      // See https://developer.paddle.com/api-reference/subscriptions/cancel-subscription
      const subs = paddle.subscriptions.list({ customerId: [paddleCustomerId] });
      for await (const sub of subs) {
        if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'paused') {
          await paddle.subscriptions.cancel(sub.id, { effectiveFrom: 'immediately' });
        }
      }
      paddleCancelled = true;
    } catch (err) {
      paddleError = err instanceof Error ? err.message : String(err);
      logger.warn('paddle_cancellation_failed', { userId, deletionId, error: paddleError });
    }
  }

  // 3. Hard-delete all Competitor records + their Change/Research children
  const { items: competitors } = await queryByPK(competitorPK(userId), 'COMP#');
  let totalChanges = 0;
  let totalResearch = 0;
  for (const comp of competitors) {
    const compId = comp.id as string;
    const [changesResult, researchResult] = await Promise.all([
      queryByPK(`COMP#${compId}`, 'CHANGE#'),
      queryByPK(`COMP#${compId}`, 'RESEARCH#'),
    ]);
    for (const c of changesResult.items) {
      await deleteItem(`COMP#${compId}`, c.SK as string);
      totalChanges++;
    }
    for (const r of researchResult.items) {
      await deleteItem(`COMP#${compId}`, r.SK as string);
      totalResearch++;
    }
    await deleteItem(competitorPK(userId), competitorSK(compId));
  }

  // 4. Delete subscription record
  await deleteItem(subscriptionPK(userId), subscriptionSK());

  // 5. Delete user record
  await deleteItem(userPK(userId), userSK());

  // 6. Delete Cognito user — invalidates all sessions, prevents re-login
  let cognitoDeleted = false;
  try {
    await cognito.send(
      new AdminDeleteUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      })
    );
    cognitoDeleted = true;
  } catch (err) {
    logger.warn('cognito_delete_failed', {
      userId,
      deletionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 7. Confirmation email
  const completedAt = new Date().toISOString();
  const certificate = `Deletion certificate
Deletion ID: ${deletionId}
Requested at: ${requestedAt}
Completed at: ${completedAt}
Account email: ${email}

Items deleted:
- ${competitors.length} competitor record(s)
- ${totalChanges} change record(s)
- ${totalResearch} research finding(s)
- 1 subscription record
- 1 user record
- Authentication account: ${cognitoDeleted ? 'deleted' : 'pending — please contact support'}
- Active subscription cancellation: ${paddleCancelled ? 'completed' : paddleCustomerId ? 'failed — please contact support' : 'no subscription on file'}

Per GDPR Art. 17 / CCPA §1798.105 your personal data has been erased from our systems. Some data may persist in encrypted backups for up to 30 days before automated rotation completes.

If you didn't request this deletion, contact support@rivalscan.com immediately.`;

  try {
    await sendEmail(
      email,
      'Your RivalScan account has been deleted',
      `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap;">${certificate}</pre>`
    );
  } catch (err) {
    logger.warn('deletion_confirmation_email_failed', {
      userId,
      deletionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('user_deletion_completed', {
    userId,
    deletionId,
    competitorCount: competitors.length,
    changeCount: totalChanges,
    researchCount: totalResearch,
    paddleCancelled,
    cognitoDeleted,
  });

  return {
    statusCode: 200,
    body: {
      data: {
        deletionId,
        requestedAt,
        completedAt,
        deleted: {
          competitors: competitors.length,
          changes: totalChanges,
          research: totalResearch,
        },
        paddleCancelled,
        cognitoDeleted,
        ...(paddleError ? { paddleNote: 'Subscription cancellation failed; please contact support.' } : {}),
      },
    },
  };
});
