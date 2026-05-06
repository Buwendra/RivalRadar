import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryGSI } from '../../../shared/db/queries';
import { validate, paginationSchema } from '../../../shared/middleware/validation';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const params = validate(paginationSchema, event.queryStringParameters ?? {});
  const minSignificance = Number(event.queryStringParameters?.minSignificance) || 0;
  const competitorId = event.queryStringParameters?.competitorId;

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

  return {
    statusCode: 200,
    body: {
      data: changes,
      meta: { cursor, hasMore: !!cursor },
    },
  };
});
