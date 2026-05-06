/**
 * DELETE /saved-views/{id}
 *
 * Phase 7b — remove a saved view. Idempotent — returns 200 even if the view
 * was already gone (clicking the X twice shouldn't 404).
 */

import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { deleteItem } from '../../../shared/db/queries';
import { savedViewPK, savedViewSK } from '../../../shared/db/keys';
import { logger } from '../../../shared/utils/logger';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const id = event.pathParameters?.id;
  if (!id) throw new HttpError(400, 'MISSING_ID', 'View id is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  await deleteItem(savedViewPK(ctx.tenantUserId), savedViewSK(id));

  logger.info('saved_view_deleted', {
    tenantUserId: ctx.tenantUserId,
    callerUserId: ctx.callerUserId,
    workspaceId: ctx.workspaceId,
    viewId: id,
  });

  return {
    statusCode: 200,
    body: { data: { id, deleted: true } },
  };
});
