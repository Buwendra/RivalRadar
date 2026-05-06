/**
 * GET /v1/changes?since=&minSignificance=&limit=&cursor=
 *
 * Phase 11 public read API. Auth via X-API-Key. Strategist+ only. Mirrors
 * `changes/list.ts` with internal fields stripped.
 */

import { apiHandler } from '../../../shared/middleware/handler';
import {
  resolveApiKeyContext,
  assertApiAccess,
} from '../../../shared/middleware/api-key';
import { queryGSI } from '../../../shared/db/queries';
import { validate, paginationSchema } from '../../../shared/middleware/validation';
import type { PublicEvent } from '../../../shared/middleware/handler';

export const handler = apiHandler<PublicEvent>(async (event) => {
  const ctx = await resolveApiKeyContext(event);
  await assertApiAccess(ctx);

  const params = validate(paginationSchema, event.queryStringParameters ?? {});
  const q = event.queryStringParameters ?? {};
  const minSignificance = Number(q.minSignificance) || 0;
  const since = q.since;

  const { items, cursor } = await queryGSI('GSI1', 'GSI1PK', ctx.tenantUserId, 'CHANGE#', {
    skName: 'GSI1SK',
    limit: params.limit ?? 50,
    cursor: params.cursor,
    scanForward: false,
  });

  let data = items.map((item) => ({
    id: item.id as string,
    competitorId: item.competitorId as string,
    competitorName: item.competitorName as string,
    pageUrl: item.pageUrl as string,
    significance: item.significance as number,
    aiAnalysis: item.aiAnalysis,
    detectedAt: item.detectedAt as string,
    citations: item.citations,
  }));

  if (minSignificance > 0) {
    data = data.filter((c) => c.significance >= minSignificance);
  }
  if (since) {
    data = data.filter((c) => typeof c.detectedAt === 'string' && c.detectedAt >= since);
  }

  return {
    statusCode: 200,
    body: {
      data,
      meta: { cursor, hasMore: !!cursor },
    },
  };
});
