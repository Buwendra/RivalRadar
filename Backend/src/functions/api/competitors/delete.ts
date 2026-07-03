import {
  apiHandler,
  getUserEmail,
  HttpError,
  getSourceIp,
  getUserAgent,
} from '../../../shared/middleware/handler';
import { deleteItem, getItem, decrementFloorZero } from '../../../shared/db/queries';
import { competitorPK, competitorSK, userPK, userSK } from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
  assertAdminOrOwner,
} from '../../../shared/middleware/tenant';
import { recordAuditEvent } from '../../../shared/services/audit';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const compId = event.pathParameters?.id;

  if (!compId) throw new HttpError(400, 'MISSING_ID', 'Competitor ID is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  assertAdminOrOwner(ctx, 'competitors');
  const userId = ctx.tenantUserId;

  const competitor = await getItem<Record<string, unknown>>(competitorPK(userId), competitorSK(compId));
  if (!competitor) {
    throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');
  }

  await deleteItem(competitorPK(userId), competitorSK(compId));

  // Release the plan-limit slot. Self rows never counted toward the limit;
  // floor-zero also protects pre-counter accounts (no attr → no-op).
  if (competitor.targetKind !== 'self') {
    await decrementFloorZero(userPK(userId), userSK(), 'competitorCount').catch(() => {});
  }

  await recordAuditEvent({
    ctx,
    action: 'competitor.deleted',
    resourceId: compId,
    resourceLabel: typeof competitor.name === 'string' ? competitor.name : undefined,
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  return {
    statusCode: 200,
    body: { data: { message: 'Competitor deleted' } },
  };
});
