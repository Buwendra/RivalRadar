/**
 * GET /notifications
 *
 * Phase 18 — list the caller's recent in-app notifications, newest-first.
 * Cursor-paginated, default page size 50. Response includes `unreadCount`
 * computed from the loaded page (v1 — exact count across all pages would
 * cost an extra Scan; deferred until volume warrants).
 */

import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import { notificationPK, notificationSKPrefix } from '../../../shared/db/keys';
import { validate, paginationSchema } from '../../../shared/middleware/validation';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { Notification } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const params = validate(paginationSchema, event.queryStringParameters ?? {});

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  const { items, cursor } = await queryByPK(
    notificationPK(ctx.callerUserId),
    notificationSKPrefix(),
    {
      limit: params.limit ?? 50,
      cursor: params.cursor,
      scanForward: false,
    }
  );

  const notifications = (items as unknown as Notification[]).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href,
    meta: n.meta,
    readAt: n.readAt,
    createdAt: n.createdAt,
  }));

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return {
    statusCode: 200,
    body: {
      data: notifications,
      meta: {
        cursor,
        hasMore: !!cursor,
        unreadCount,
      },
    },
  };
});
