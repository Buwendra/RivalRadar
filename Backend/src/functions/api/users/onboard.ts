import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { validate, onboardSchema } from '../../../shared/middleware/validation';
import { putItem, updateItem, queryGSI, getItem } from '../../../shared/db/queries';
import { userPK, userSK, competitorPK, competitorSK, gsi2ActiveCompetitorKeys } from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { PLAN_LIMITS, User } from '../../../shared/types';
import { enforceResearchEligibility } from '../../../shared/utils/research-eligibility';

const sfn = new SFNClient({});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(onboardSchema, parseBody(event));

  // Find user
  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  // Check plan limit
  const maxCompetitors = PLAN_LIMITS[user.plan].maxCompetitors;
  if (body.competitors.length > maxCompetitors) {
    throw new HttpError(
      403,
      'PLAN_LIMIT',
      `Your ${user.plan} plan allows up to ${maxCompetitors} competitors. You submitted ${body.competitors.length}.`
    );
  }

  // Misuse-defense gate: bulk pre-check ALL competitors before any DB writes.
  // If any single competitor fails, the whole onboard fails — better UX than
  // partial success. Counts each competitor against the user's daily quota.
  const eligibility = await enforceResearchEligibility({
    user,
    competitors: body.competitors.map((c) => ({ name: c.name, url: c.url })),
  });
  if (!eligibility.allowed) {
    const status = eligibility.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 403;
    throw new HttpError(
      status,
      eligibility.code ?? 'NOT_ALLOWED',
      eligibility.reason ?? 'One or more of your competitor entries is not allowed.'
    );
  }

  // Create competitor records
  const now = new Date().toISOString();
  const competitorIds: string[] = [];

  for (const comp of body.competitors) {
    const compId = generateId();
    competitorIds.push(compId);

    await putItem({
      PK: competitorPK(userId),
      SK: competitorSK(compId),
      id: compId,
      userId,
      name: comp.name,
      url: comp.url,
      pagesToTrack: comp.pagesToTrack,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...gsi2ActiveCompetitorKeys(compId),
    });
  }

  // Mark onboarding complete + record consent versions for audit trail.
  // Consent captured here because this is the first User row write after
  // signup; signup itself only creates the Cognito user.
  const consentUpdates: Record<string, unknown> = {
    onboardingComplete: true,
    companyName: body.companyName,
    industry: body.industry,
    updatedAt: now,
  };
  if (body.tosVersion) {
    consentUpdates.tosVersion = body.tosVersion;
    consentUpdates.tosAcceptedAt = now;
  }
  if (body.privacyVersion) {
    consentUpdates.privacyVersion = body.privacyVersion;
    consentUpdates.privacyAcceptedAt = now;
  }
  await updateItem(userPK(userId), userSK(), consentUpdates);

  // Trigger initial deep research for each new competitor
  if (process.env.RESEARCH_PIPELINE_ARN) {
    const researchInput = body.competitors.map((comp, i) => ({
      competitorId: competitorIds[i],
      userId,
      name: comp.name,
      url: comp.url,
      industry: body.industry,
    }));
    await sfn.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.RESEARCH_PIPELINE_ARN,
        input: JSON.stringify({ competitors: researchInput }),
      })
    );
  }

  return {
    statusCode: 200,
    body: {
      data: {
        message: 'Onboarding complete. Initial research started.',
        competitorIds,
      },
    },
  };
});
