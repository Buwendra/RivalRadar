import { z } from 'zod';
import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryGSI, getItem } from '../../../shared/db/queries';
import { validate, paginationSchema } from '../../../shared/middleware/validation';
import { userPK, userSK } from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { Recommendation, RecommendationStatus, PlanTier } from '../../../shared/types';

const filterSchema = paginationSchema.extend({
  status: z.enum(['open', 'dismissed', 'acted-on']).optional(),
});

// Tier-gated visibility cap. Backend enforcement so a low-tier user can't
// just paginate past the cap from a custom client. Mirrors the Phase 6
// Capability matrix the roadmap calls for.
const VISIBLE_BY_TIER: Record<PlanTier, number> = {
  scout: 3,
  strategist: 10,
  command: -1, // unlimited
};

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const params = validate(filterSchema, event.queryStringParameters ?? {});

  const userRecord = await getItem<Record<string, unknown>>(userPK(userId), userSK());
  const tier = ((userRecord?.plan as PlanTier | undefined) ?? 'scout') as PlanTier;
  const tierCap = VISIBLE_BY_TIER[tier];

  const { items, cursor } = await queryGSI('GSI1', 'GSI1PK', userId, 'REC#', {
    skName: 'GSI1SK',
    limit: params.limit,
    cursor: params.cursor,
    scanForward: false, // newest first
  });

  let recs = items as unknown as Recommendation[];
  if (params.status) {
    const wanted: RecommendationStatus = params.status;
    recs = recs.filter((r) => r.status === wanted);
  }

  // Tier cap is applied to the open subset only — dismissed / acted-on
  // recommendations remain fully accessible (they're useful for the
  // outcome-tracking analytics in Phase 8 and the user's own retrospective).
  if (tierCap > 0) {
    let openSeen = 0;
    recs = recs.filter((r) => {
      if (r.status !== 'open') return true;
      openSeen += 1;
      return openSeen <= tierCap;
    });
  }

  return {
    statusCode: 200,
    body: {
      data: recs,
      meta: { cursor, hasMore: !!cursor },
    },
  };
});
