import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryByPK, queryGSI } from '../../../shared/db/queries';
import { competitorPK } from '../../../shared/db/keys';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const { items } = await queryByPK(competitorPK(userId), 'COMP#', { scanForward: true });

  const competitors = items.map((item) => ({
    id: item.id,
    name: item.name,
    url: item.url,
    pagesToTrack: item.pagesToTrack,
    status: item.status,
    createdAt: item.createdAt,
    momentum: item.momentum,
    momentumChangePercent: item.momentumChangePercent,
    momentumAsOf: item.momentumAsOf,
    threatLevel: item.threatLevel,
    threatReasoning: item.threatReasoning,
    threatAsOf: item.threatAsOf,
    derivedTags: item.derivedTags,
    derivedTagsAsOf: item.derivedTagsAsOf,
    predictedMoves: item.predictedMoves,
    predictedMovesAsOf: item.predictedMovesAsOf,
    predictionHistory: item.predictionHistory,
    predictionHistoryAsOf: item.predictionHistoryAsOf,
  }));

  return {
    statusCode: 200,
    body: { data: competitors },
  };
});
