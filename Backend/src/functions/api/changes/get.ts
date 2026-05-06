import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryGSI } from '../../../shared/db/queries';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const changeId = event.pathParameters?.id;

  if (!changeId) throw new HttpError(400, 'MISSING_ID', 'Change ID is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const { items } = await queryGSI('GSI1', 'GSI1PK', userId, 'CHANGE#', {
    skName: 'GSI1SK',
    limit: 100,
  });

  const change = items.find((item) => item.id === changeId);
  if (!change) {
    throw new HttpError(404, 'NOT_FOUND', 'Change not found');
  }

  return {
    statusCode: 200,
    body: {
      data: {
        id: change.id,
        competitorId: change.competitorId,
        competitorName: change.competitorName,
        pageUrl: change.pageUrl,
        diffSummary: change.diffSummary,
        significance: change.significance,
        aiAnalysis: change.aiAnalysis,
        feedbackHelpful: change.feedbackHelpful,
        detectedAt: change.detectedAt,
      },
    },
  };
});
