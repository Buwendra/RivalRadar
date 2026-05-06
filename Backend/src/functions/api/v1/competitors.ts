/**
 * GET /v1/competitors
 *
 * Phase 11 public read API. Auth via X-API-Key. Strategist+ only.
 * Mirrors the dashboard's competitor list endpoint with internal fields
 * stripped.
 */

import { apiHandler } from '../../../shared/middleware/handler';
import {
  resolveApiKeyContext,
  assertApiAccess,
} from '../../../shared/middleware/api-key';
import { queryByPK } from '../../../shared/db/queries';
import { competitorPK } from '../../../shared/db/keys';
import { validate, paginationSchema } from '../../../shared/middleware/validation';
import type { PublicEvent } from '../../../shared/middleware/handler';

export const handler = apiHandler<PublicEvent>(async (event) => {
  const ctx = await resolveApiKeyContext(event);
  await assertApiAccess(ctx);

  const params = validate(paginationSchema, event.queryStringParameters ?? {});

  const { items, cursor } = await queryByPK(competitorPK(ctx.tenantUserId), 'COMP#', {
    limit: params.limit ?? 50,
    cursor: params.cursor,
    scanForward: true,
  });

  const data = items.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    url: c.url as string,
    status: c.status as string,
    threatLevel: c.threatLevel,
    momentum: c.momentum,
    momentumChangePercent: c.momentumChangePercent,
    derivedTags: (c.derivedTags as string[] | undefined) ?? [],
    createdAt: c.createdAt as string,
    updatedAt: c.updatedAt as string,
  }));

  return {
    statusCode: 200,
    body: {
      data,
      meta: { cursor, hasMore: !!cursor },
    },
  };
});
