import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryGSI } from '../../../shared/db/queries';
import { validate, paginationSchema } from '../../../shared/middleware/validation';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

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
