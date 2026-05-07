/**
 * DELETE /saved-views/{id}/subscribe
 *
 * Phase 15 — caller unsubscribes from a saved view's weekly digest.
 * Idempotent — DynamoDB delete is a no-op if the row is absent.
 */

import {
  apiHandler,
  getUserEmail,
  HttpError,
} from '../../../shared/middleware/handler';
import { deleteItem } from '../../../shared/db/queries';
import {
  savedViewSubscriptionPK,
  savedViewSubscriptionSK,
} from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { logger } from '../../../shared/utils/logger';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const viewId = event.pathParameters?.id;
  if (!viewId) throw new HttpError(400, 'MISSING_ID', 'View id is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  await deleteItem(
    savedViewSubscriptionPK(ctx.callerUserId),
    savedViewSubscriptionSK(ctx.workspaceId, viewId)
  );

  logger.info('saved_view_unsubscribed', {
    workspaceId: ctx.workspaceId,
    viewId,
    subscriberUserId: ctx.callerUserId,
  });

  return {
    statusCode: 200,
    body: { data: { viewId, subscribed: false } },
  };
});
