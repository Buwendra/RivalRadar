import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import { competitorPK } from '../../../shared/db/keys';
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
