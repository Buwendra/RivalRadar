import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { getItem, queryGSI } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';
import { validate, paginationSchema } from '../../../shared/middleware/validation';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { User } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const params = validate(paginationSchema, event.queryStringParameters ?? {});
  const q = event.queryStringParameters ?? {};
  const userMinSignificance = Number(q.minSignificance) || 0;
  const competitorId = q.competitorId;
  const changeTypes = q.changeTypes
    ? q.changeTypes.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const sinceDays = q.sinceDays ? Math.max(0, Number(q.sinceDays) || 0) : undefined;

  // Phase 7b — workspace-shared threshold lives on the tenant owner's User
  // record. The user-supplied filter can be MORE restrictive than the floor
  // but never less.
  const tenantUser = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  const workspaceFloor = tenantUser?.feedSignificanceThreshold ?? 0;
  const minSignificance = Math.max(userMinSignificance, workspaceFloor);

  const sinceIso = sinceDays
    ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const { items, cursor } = await queryGSI('GSI1', 'GSI1PK', userId, 'CHANGE#', {
    skName: 'GSI1SK',
    limit: params.limit,
    cursor: params.cursor,
    scanForward: false,
  });

  let changes = items.map((item) => ({
    id: item.id,
    competitorId: item.competitorId,
    competitorName: item.competitorName,
    pageUrl: item.pageUrl,
    significance: item.significance as number,
    aiAnalysis: item.aiAnalysis,
    detectedAt: item.detectedAt,
  }));

  if (minSignificance > 0) {
    changes = changes.filter((c) => c.significance >= minSignificance);
  }
  if (competitorId) {
    changes = changes.filter((c) => c.competitorId === competitorId);
  }
  if (changeTypes && changeTypes.length > 0) {
    const set = new Set(changeTypes);
    changes = changes.filter((c) => {
      const a = c.aiAnalysis as Record<string, unknown> | undefined;
      const t = a?.changeType;
      return typeof t === 'string' && set.has(t);
    });
  }
  if (sinceIso) {
    changes = changes.filter((c) => typeof c.detectedAt === 'string' && c.detectedAt >= sinceIso);
  }

  return {
    statusCode: 200,
    body: {
      data: changes,
      meta: { cursor, hasMore: !!cursor },
    },
  };
});
