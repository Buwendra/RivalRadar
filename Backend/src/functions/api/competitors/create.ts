import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { validate, competitorCreateSchema } from '../../../shared/middleware/validation';
import { putItem, queryByPK, getItem, queryGSI } from '../../../shared/db/queries';
import { userPK, userSK, competitorPK, competitorSK, gsi2ActiveCompetitorKeys } from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { PLAN_LIMITS, User } from '../../../shared/types';
import { enforceResearchEligibility } from '../../../shared/utils/research-eligibility';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(competitorCreateSchema, parseBody(event));

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  const { items: existing } = await queryByPK(competitorPK(userId), 'COMP#');
  const maxCompetitors = PLAN_LIMITS[user.plan].maxCompetitors;

  if (existing.length >= maxCompetitors) {
    throw new HttpError(
      403,
      'PLAN_LIMIT',
      `Your ${user.plan} plan allows up to ${maxCompetitors} competitors. Upgrade to add more.`
    );
  }

  // Misuse-defense gate before persisting the competitor. Account status,
  // sanctions denylist, rate limit, Haiku classifier — see
  // shared/utils/research-eligibility.ts. Note: rate limit increments here,
  // so a rejected create does NOT count against the user's daily quota.
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

  const compId = generateId();
  const now = new Date().toISOString();

  await putItem({
    PK: competitorPK(userId),
    SK: competitorSK(compId),
    id: compId,
    userId,
    name: body.name,
    url: body.url,
    pagesToTrack: body.pagesToTrack,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...gsi2ActiveCompetitorKeys(compId),
  });

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
