/**
 * POST /v1/competitors
 *
 * Phase 13 — public write API. Auth via X-API-Key with `write` scope.
 * Strategist+ only. Mirrors `competitors/create.ts` end-to-end (plan-limit,
 * eligibility checks, sanctions/classifier) so business rules stay in one
 * conceptual surface; this handler is just a thin scope-gated wrapper.
 *
 * Audits `api.competitor_created` so workspace owners can see exactly which
 * key created which competitor.
 */

import {
  apiHandler,
  parseBody,
  HttpError,
  getSourceIp,
  getUserAgent,
} from '../../../shared/middleware/handler';
import {
  resolveApiKeyContext,
  assertApiAccess,
} from '../../../shared/middleware/api-key';
import {
  getItem,
  putItem,
  queryByPK,
  initCounterIfAbsent,
  incrementWithCeiling,
  decrementFloorZero,
} from '../../../shared/db/queries';
import {
  competitorPK,
  competitorSK,
  gsi2ActiveCompetitorKeys,
  userPK,
  userSK,
} from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { validate, competitorCreateSchema } from '../../../shared/middleware/validation';
import { enforceResearchEligibility } from '../../../shared/utils/research-eligibility';
import { competitorsOnly } from '../../../shared/utils/competitor-target';
import { recordAuditEvent } from '../../../shared/services/audit';
import { PLAN_LIMITS } from '../../../shared/types';
import type { PublicEvent } from '../../../shared/middleware/handler';
import type { User } from '../../../shared/types';

export const handler = apiHandler<PublicEvent>(async (event) => {
  const ctx = await resolveApiKeyContext(event, { requireScope: 'write' });
  await assertApiAccess(ctx);
  const body = validate(competitorCreateSchema, parseBody(event));

  const userId = ctx.tenantUserId;

  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'Workspace owner not found');

  // Phase 23 — self-brand row does not count against the competitor quota.
  // Enforcement mirrors competitors/create.ts: atomic counter with ceiling.
  const { items: existing } = await queryByPK(competitorPK(userId), 'COMP#');
  const existingCompetitors = competitorsOnly(existing);
  const maxCompetitors = PLAN_LIMITS[user.plan].maxCompetitors;
  if (typeof user.competitorCount !== 'number') {
    await initCounterIfAbsent(
      userPK(userId),
      userSK(),
      'competitorCount',
      existingCompetitors.length
    );
  }

  const eligibility = await enforceResearchEligibility({
    user,
    competitors: [{ name: body.name, url: body.url }],
  });
  if (!eligibility.allowed) {
    const status = eligibility.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 403;
    throw new HttpError(
      status,
      eligibility.code ?? 'NOT_ALLOWED',
      eligibility.reason ?? 'This competitor entry is not allowed.'
    );
  }

  const admitted = await incrementWithCeiling(
    userPK(userId),
    userSK(),
    'competitorCount',
    maxCompetitors
  );
  if (!admitted) {
    throw new HttpError(
      403,
      'PLAN_LIMIT',
      `Workspace plan (${user.plan}) allows up to ${maxCompetitors} competitors. Upgrade to add more.`
    );
  }

  const compId = generateId();
  const now = new Date().toISOString();

  try {
    await putItem({
      PK: competitorPK(userId),
      SK: competitorSK(compId),
      id: compId,
      userId,
      name: body.name,
      url: body.url,
      pagesToTrack: body.pagesToTrack,
      status: 'active',
      targetKind: 'competitor',
      createdAt: now,
      updatedAt: now,
      ...gsi2ActiveCompetitorKeys(compId),
    });
  } catch (err) {
    await decrementFloorZero(userPK(userId), userSK(), 'competitorCount').catch(() => {});
    throw err;
  }

  await recordAuditEvent({
    ctx,
    action: 'api.competitor_created',
    resourceId: compId,
    resourceLabel: body.name,
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  return {
    statusCode: 201,
    body: {
      data: {
        id: compId,
        name: body.name,
        url: body.url,
        pagesToTrack: body.pagesToTrack,
        status: 'active' as const,
        createdAt: now,
      },
    },
  };
});
