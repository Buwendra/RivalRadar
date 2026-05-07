/**
 * GET /competitors/matrix
 *
 * Phase 19 — cross-competitor comparison matrix. Returns every competitor
 * in the tenant joined with the latest `ResearchFinding.derivedState` for a
 * sortable side-by-side view. Strategist+ tier-gated (Scout sees 403 +
 * upgrade card client-side).
 */

import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { getItem } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';
import { hasCapability } from '../../../shared/utils/capability';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { buildCompetitorMatrix } from '../../../shared/services/competitor-matrix';
import type { User } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  const user = await getItem<User>(userPK(ctx.tenantUserId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  if (!hasCapability(user, 'comparatorMatrix')) {
    throw new HttpError(
      403,
      'PLAN_REQUIRED',
      'The comparison matrix requires the Strategist plan or higher.'
    );
  }

  const rows = await buildCompetitorMatrix(ctx.tenantUserId);

  return {
    statusCode: 200,
    body: { data: rows },
  };
});
