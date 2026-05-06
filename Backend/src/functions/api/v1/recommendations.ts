/**
 * GET /v1/recommendations
 *
 * Phase 11 public read API. Auth via X-API-Key. Strategist+ only. Returns
 * the workspace's recommendations newest-first with internal fields stripped.
 */

import { apiHandler } from '../../../shared/middleware/handler';
import {
  resolveApiKeyContext,
  assertApiAccess,
} from '../../../shared/middleware/api-key';
import { queryByPK } from '../../../shared/db/queries';
import { recommendationPK } from '../../../shared/db/keys';
import { validate, paginationSchema } from '../../../shared/middleware/validation';
import type { PublicEvent } from '../../../shared/middleware/handler';

export const handler = apiHandler<PublicEvent>(async (event) => {
  const ctx = await resolveApiKeyContext(event);
  await assertApiAccess(ctx);

  const params = validate(paginationSchema, event.queryStringParameters ?? {});

  const { items, cursor } = await queryByPK(recommendationPK(ctx.tenantUserId), 'REC#', {
    limit: params.limit ?? 50,
    cursor: params.cursor,
    scanForward: false,
  });

  const data = items.map((r) => ({
    id: r.id as string,
    competitorId: r.competitorId,
    competitorName: r.competitorName,
    category: r.category as string,
    title: r.title as string,
    body: r.body as string,
    effortLevel: r.effortLevel,
    timeHorizon: r.timeHorizon,
    confidence: r.confidence,
    status: r.status,
    createdAt: r.createdAt as string,
  }));

  return {
    statusCode: 200,
    body: {
      data,
      meta: { cursor, hasMore: !!cursor },
    },
  };
});
