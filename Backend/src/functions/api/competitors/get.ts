import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryByPK, queryGSI, getItem } from '../../../shared/db/queries';
import { competitorPK, competitorSK } from '../../../shared/db/keys';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const compId = event.pathParameters?.id;

  if (!compId) throw new HttpError(400, 'MISSING_ID', 'Competitor ID is required');

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const competitor = await getItem<Record<string, unknown>>(competitorPK(userId), competitorSK(compId));
  if (!competitor) {
    throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');
  }

  const [{ items: changes }, { items: research }] = await Promise.all([
    queryByPK(`COMP#${compId}`, 'CHANGE#', { limit: 10 }),
    queryByPK(`COMP#${compId}`, 'RESEARCH#', { limit: 5 }),
  ]);

  return {
    statusCode: 200,
    body: {
      data: {
        id: competitor.id,
        name: competitor.name,
        url: competitor.url,
        pagesToTrack: competitor.pagesToTrack,
        status: competitor.status,
        createdAt: competitor.createdAt,
        recentChanges: changes.map((c) => ({
          id: c.id,
          significance: c.significance,
          aiAnalysis: c.aiAnalysis,
          detectedAt: c.detectedAt,
        })),
        recentResearch: research.map((r) => ({
          id: r.id,
          competitorId: r.competitorId,
          userId: r.userId,
          generatedAt: r.generatedAt,
          summary: r.summary,
          categories: r.categories,
          citations: r.citations,
          searchQueries: r.searchQueries,
          tokensUsed: r.tokensUsed,
        })),
      },
    },
  };
});
