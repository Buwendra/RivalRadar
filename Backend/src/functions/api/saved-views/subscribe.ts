/**
 * POST /saved-views/{id}/subscribe
 *
 * Phase 15 — caller subscribes to a saved view's weekly email digest.
 * Per-caller, not per-workspace: each member subscribes independently.
 * Idempotent — re-subscribing is a no-op (overwrites the row with the
 * same content).
 */

import {
  apiHandler,
  getUserEmail,
  HttpError,
} from '../../../shared/middleware/handler';
import { getItem, putItem } from '../../../shared/db/queries';
import {
  savedViewPK,
  savedViewSK,
  savedViewSubscriptionPK,
  savedViewSubscriptionSK,
} from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { logger } from '../../../shared/utils/logger';
import type { SavedView, SavedViewSubscription } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const viewId = event.pathParameters?.id;
  if (!viewId) throw new HttpError(400, 'MISSING_ID', 'View id is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  // Confirm the view exists in the current workspace before creating the
  // subscription — prevents zombie subscriptions to non-existent views.
  const view = await getItem<SavedView>(
    savedViewPK(ctx.tenantUserId),
    savedViewSK(viewId)
  );
  if (!view) throw new HttpError(404, 'NOT_FOUND', 'Saved view not found');

  const now = new Date().toISOString();
  const row: SavedViewSubscription = {
    subscriberUserId: ctx.callerUserId,
    subscriberEmail: ctx.callerEmail,
    workspaceId: ctx.workspaceId,
    viewId,
    cadence: 'weekly',
    createdAt: now,
  };

  await putItem({
    PK: savedViewSubscriptionPK(ctx.callerUserId),
    SK: savedViewSubscriptionSK(ctx.workspaceId, viewId),
    ...row,
  });

  logger.info('saved_view_subscribed', {
    workspaceId: ctx.workspaceId,
    viewId,
    subscriberUserId: ctx.callerUserId,
  });

  return {
    statusCode: 200,
    body: { data: { viewId, subscribed: true } },
  };
});
