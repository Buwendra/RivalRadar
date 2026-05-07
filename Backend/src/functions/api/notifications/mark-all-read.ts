/**
 * POST /notifications/mark-all-read
 *
 * Phase 18 — mark every unread notification for the caller read in one
 * shot. Walks the caller's notification rows via paginated queryByPK
 * (limit 50 per page), updates each unread row in parallel per page.
 * Best-effort — per-row failures log + continue.
 *
 * Volume bound: 90-day TTL × ~5 events/day = ~450 rows max per user.
 * Multiple pages but cheap.
 */

import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryByPK, updateItem } from '../../../shared/db/queries';
import { notificationPK, notificationSKPrefix } from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { logger } from '../../../shared/utils/logger';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  const now = new Date().toISOString();
  let marked = 0;
  let cursor: string | undefined;

  // Walk all pages until cursor is exhausted.
  do {
    const result = await queryByPK(
      notificationPK(ctx.callerUserId),
      notificationSKPrefix(),
      { limit: 50, scanForward: false, cursor }
    );
    const unread = result.items.filter((n) => !n.readAt);
    await Promise.all(
      unread.map((row) =>
        updateItem(
          notificationPK(ctx.callerUserId),
          row.SK as string,
          { readAt: now }
        ).catch((err) => {
          logger.warn('mark_all_read_row_failed', {
            id: row.id,
            err: err instanceof Error ? err.message : String(err),
          });
        })
      )
    );
    marked += unread.length;
    cursor = result.cursor;
  } while (cursor);

  logger.info('notifications_mark_all_read', {
    callerUserId: ctx.callerUserId,
    marked,
  });

  return {
    statusCode: 200,
    body: { data: { marked } },
  };
});
