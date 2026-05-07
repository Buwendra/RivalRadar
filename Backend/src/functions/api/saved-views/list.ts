/**
 * GET /saved-views
 *
 * Phase 7b — list the workspace's saved filter views. Visible to all
 * members; created by any member, but the `savedViews.max` cap is enforced
 * per workspace based on the owner's plan.
 *
 * Phase 15 — annotates each view with `subscribed: boolean` based on the
 * caller's per-user subscription state for the current workspace.
 */

import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import {
  savedViewPK,
  savedViewSKPrefix,
  savedViewSubscriptionPK,
  savedViewSubscriptionSKPrefix,
} from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { SavedView } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  // Fetch the workspace's views + the caller's subscriptions in parallel.
  const [viewsResult, subsResult] = await Promise.all([
    queryByPK(savedViewPK(ctx.tenantUserId), savedViewSKPrefix()),
    queryByPK(
      savedViewSubscriptionPK(ctx.callerUserId),
      savedViewSubscriptionSKPrefix()
    ),
  ]);

  // Build the set of viewIds the caller is subscribed to in THIS workspace.
  // Subscription SK shape: VIEW_SUB#<workspaceId>#<viewId>
  const wsPrefix = `VIEW_SUB#${ctx.workspaceId}#`;
  const subscribedViewIds = new Set<string>();
  for (const row of subsResult.items) {
    const sk = row.SK as string | undefined;
    if (sk && sk.startsWith(wsPrefix)) {
      subscribedViewIds.add(sk.slice(wsPrefix.length));
    }
  }

  const views = (viewsResult.items as unknown as SavedView[]).map((v) => ({
    id: v.id,
    name: v.name,
    filters: v.filters,
    createdByUserId: v.createdByUserId,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    subscribed: subscribedViewIds.has(v.id),
  }));

  return {
    statusCode: 200,
    body: { data: views },
  };
});
