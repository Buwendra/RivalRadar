/**
 * PATCH /notifications/{id}/read
 *
 * Phase 18 — mark a single notification read. Idempotent — re-marking is
 * a no-op (sets the same readAt overwrite).
 *
 * Lookup: notifications are SK'd as NOTIF#<ts>#<id>. We don't have the
 * timestamp on the path, so we scan the caller's recent notifications
 * (cap 100) and locate the matching id. Cheap at v1 volumes.
 */

import {
  apiHandler,
  getUserEmail,
  HttpError,
} from '../../../shared/middleware/handler';
import { queryByPK, updateItem } from '../../../shared/db/queries';
import { notificationPK, notificationSKPrefix } from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const id = event.pathParameters?.id;
  if (!id) throw new HttpError(400, 'MISSING_ID', 'Notification id is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  const { items } = await queryByPK(
    notificationPK(ctx.callerUserId),
    notificationSKPrefix(),
    { limit: 100, scanForward: false }
  );
  const target = items.find((n) => n.id === id);
  if (!target) throw new HttpError(404, 'NOT_FOUND', 'Notification not found');

  const sk = target.SK as string | undefined;
  if (!sk) throw new HttpError(500, 'INTERNAL', 'Notification missing SK');

  if (target.readAt) {
    return {
      statusCode: 200,
      body: { data: { id, readAt: target.readAt as string } },
    };
  }

  const now = new Date().toISOString();
  await updateItem(notificationPK(ctx.callerUserId), sk, { readAt: now });

  return {
    statusCode: 200,
    body: { data: { id, readAt: now } },
  };
});
