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
import { queryGSI, skPrefixRange } from '../../../shared/db/queries';
import { validate, paginationSchema } from '../../../shared/middleware/validation';
import type { PublicEvent } from '../../../shared/middleware/handler';

export const handler = apiHandler<PublicEvent>(async (event) => {
  const ctx = await resolveApiKeyContext(event);
  await assertApiAccess(ctx);

  const params = validate(paginationSchema, event.queryStringParameters ?? {});
  const q = event.queryStringParameters ?? {};
  const minSignificance = Number(q.minSignificance) || 0;
  const since = q.since;

  // `since` at the key level (see changes/list.ts) — post-filtering after the
  // DDB Limit broke pagination semantics. minSignificance stays a post-filter.
  const { items, cursor } = await queryGSI(
    'GSI1',
    'GSI1PK',
    ctx.tenantUserId,
    since ? undefined : 'CHANGE#',
    {
      skName: 'GSI1SK',
      ...(since ? { skBetween: skPrefixRange('CHANGE#', since) } : {}),
      limit: params.limit ?? 50,
      cursor: params.cursor,
      scanForward: false,
    }
  );

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
  // `since` is enforced at the key level above; no post-filter needed.

  return {
    statusCode: 200,
    body: {
      data,
      meta: { cursor, hasMore: !!cursor },
    },
  };
});
