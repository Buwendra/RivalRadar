/**
 * GET /brand/coverage
 *
 * Phase 23 — Brand Pulse. Paginated stream of Change records belonging to the
 * workspace's self-brand row. Mirrors `changes/list.ts` shape but scoped to a
 * single competitor (the self row) for simplicity.
 */

import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import { validate, paginationSchema } from '../../../shared/middleware/validation';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { loadSelfBrand, loadUserForBrand, assertBrandPulseCapability } from './_shared';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await loadUserForBrand(userId);
  assertBrandPulseCapability(user);

  const self = await loadSelfBrand(userId);
  if (!self) {
    throw new HttpError(404, 'BRAND_NOT_SET_UP', 'Set up your brand profile to see coverage.');
  }

  const params = validate(paginationSchema, event.queryStringParameters ?? {});

  const { items, cursor } = await queryByPK(`COMP#${self.id}`, 'CHANGE#', {
    limit: params.limit ?? 20,
    cursor: params.cursor,
    scanForward: false,
  });

  const data = items.map((c) => ({
    id: c.id as string,
    significance: c.significance as number,
    pageUrl: c.pageUrl as string,
    aiAnalysis: c.aiAnalysis,
    detectedAt: c.detectedAt as string,
    sourceCategory: c.sourceCategory as string | undefined,
    citations: c.citations,
  }));

  return {
    statusCode: 200,
    body: {
      data,
      meta: { cursor, hasMore: !!cursor },
    },
  };
});
