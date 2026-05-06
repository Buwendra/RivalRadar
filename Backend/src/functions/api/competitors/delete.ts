import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { deleteItem, getItem } from '../../../shared/db/queries';
import { competitorPK, competitorSK } from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const compId = event.pathParameters?.id;

  if (!compId) throw new HttpError(400, 'MISSING_ID', 'Competitor ID is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const competitor = await getItem<Record<string, unknown>>(competitorPK(userId), competitorSK(compId));
  if (!competitor) {
    throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');
  }

  await deleteItem(competitorPK(userId), competitorSK(compId));

  return {
    statusCode: 200,
    body: { data: { message: 'Competitor deleted' } },
  };
});
