/**
 * GET /saved-views
 *
 * Phase 7b — list the workspace's saved filter views. Visible to all
 * members; created by any member, but the `savedViews.max` cap is enforced
 * per workspace based on the owner's plan.
 */

import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import { savedViewPK, savedViewSKPrefix } from '../../../shared/db/keys';
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

  const { items } = await queryByPK(
    savedViewPK(ctx.tenantUserId),
    savedViewSKPrefix()
  );

  const views = (items as unknown as SavedView[]).map((v) => ({
    id: v.id,
    name: v.name,
    filters: v.filters,
    createdByUserId: v.createdByUserId,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  }));

  return {
    statusCode: 200,
    body: { data: views },
  };
});
