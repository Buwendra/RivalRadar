import { z } from 'zod';
import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { getItem } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';
import { dispatchTestPing } from '../../../shared/services/notifier';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { User, IntegrationProvider } from '../../../shared/types';

const providerSchema = z.enum(['slack', 'webhook']);

/**
 * POST /integrations/{provider}/test
 *
 * Sends a test ping through the integration so the user can verify the
 * webhook URL and (for webhook) signature handling works on their end.
 * Returns 200 + { delivered: true } on success, 4xx with the adapter error
 * on failure (so the UI can show "couldn't reach Slack: 404").
 */
export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const providerRaw = event.pathParameters?.provider;
  const provider: IntegrationProvider = providerSchema.parse(providerRaw);

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  const result = await dispatchTestPing({
    user: {
      userId,
      email: user.email,
      name: user.name ?? '',
      notificationPreferences: (user as { notificationPreferences?: User['notificationPreferences'] })
        .notificationPreferences,
    },
    provider,
  });

  if (!result.ok) {
    return {
      statusCode: 502,
      body: {
        error: {
          code: 'DELIVERY_FAILED',
          message: result.error ?? 'Test delivery failed',
        },
      },
    };
  }

  return {
    statusCode: 200,
    body: { data: { delivered: true } },
  };
});
