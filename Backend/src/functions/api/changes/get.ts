import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryGSI } from '../../../shared/db/queries';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const changeId = event.pathParameters?.id;

  if (!changeId) throw new HttpError(400, 'MISSING_ID', 'Change ID is required');

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

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
