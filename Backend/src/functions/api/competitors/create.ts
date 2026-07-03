import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { validate, competitorCreateSchema } from '../../../shared/middleware/validation';
import {
  putItem,
  queryByPK,
  getItem,
  initCounterIfAbsent,
  incrementWithCeiling,
  decrementFloorZero,
} from '../../../shared/db/queries';
import { userPK, userSK, competitorPK, competitorSK, gsi2ActiveCompetitorKeys } from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { PLAN_LIMITS, User } from '../../../shared/types';
import { enforceResearchEligibility } from '../../../shared/utils/research-eligibility';
import { competitorsOnly } from '../../../shared/utils/competitor-target';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(competitorCreateSchema, parseBody(event));
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  // Phase 23 — exclude self-brand from the plan-limit competitor count so
  // monitoring your own brand doesn't consume a competitor slot.
  const { items: existing } = await queryByPK(competitorPK(userId), 'COMP#');
  const existingCompetitors = competitorsOnly(existing);
  const maxCompetitors = PLAN_LIMITS[user.plan].maxCompetitors;

  // Plan-limit enforcement is a conditional counter on the User row, not a
  // read-count-then-put (two concurrent creates at max-1 both passed that
  // check and landed max+1 rows). Lazy-init seeds the counter from the row
  // count the first time a pre-counter account creates a competitor.
  if (typeof user.competitorCount !== 'number') {
    await initCounterIfAbsent(
      userPK(userId),
      userSK(),
      'competitorCount',
      existingCompetitors.length
    );
  }

  // Misuse-defense gate before persisting the competitor. Account status,
  // sanctions denylist, rate limit, Haiku classifier — see
  // shared/utils/research-eligibility.ts. Runs BEFORE the counter increment
  // so a rejected create never consumes a plan slot.
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
      `Your ${user.plan} plan allows up to ${maxCompetitors} competitors. Upgrade to add more.`
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
    // Release the slot the failed create claimed.
    await decrementFloorZero(userPK(userId), userSK(), 'competitorCount').catch(() => {});
    throw err;
  }

  return {
    statusCode: 201,
    body: {
      data: {
        id: compId,
        name: body.name,
        url: body.url,
        pagesToTrack: body.pagesToTrack,
        status: 'active',
        createdAt: now,
      },
    },
  };
});
