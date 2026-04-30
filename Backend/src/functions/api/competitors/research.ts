import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { getItem, queryGSI } from '../../../shared/db/queries';
import { competitorPK, competitorSK, userPK, userSK } from '../../../shared/db/keys';
import { enforceResearchEligibility } from '../../../shared/utils/research-eligibility';
import type { User } from '../../../shared/types/user';

const sfn = new SFNClient({});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const compId = event.pathParameters?.id;

  if (!compId) throw new HttpError(400, 'MISSING_ID', 'Competitor ID is required');

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const [user, competitor] = await Promise.all([
    getItem<User & Record<string, unknown>>(userPK(userId), userSK()),
    getItem<Record<string, unknown>>(competitorPK(userId), competitorSK(compId)),
  ]);
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  if (!competitor) throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');

  // Misuse-defense gate: status check + sanctions denylist + rate limit + Haiku classifier.
  // Failures here surface as 4xx with an actionable reason (and the rate-limit reset window
  // when applicable). The competitor is already in the DB so the classifier mostly catches
  // edge cases like the user editing the URL to something inappropriate post-creation.
  const eligibility = await enforceResearchEligibility({
    user,
    competitors: [{ name: String(competitor.name), url: String(competitor.url) }],
  });
  if (!eligibility.allowed) {
    const status = eligibility.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 403;
    throw new HttpError(
      status,
      eligibility.code ?? 'NOT_ALLOWED',
      eligibility.reason ?? 'Research is not allowed for this target.'
    );
  }

  if (!process.env.RESEARCH_PIPELINE_ARN) {
    throw new HttpError(503, 'PIPELINE_NOT_CONFIGURED', 'Research pipeline not configured');
  }

  await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: process.env.RESEARCH_PIPELINE_ARN,
      input: JSON.stringify({
        competitors: [
          {
            competitorId: compId,
            userId,
            name: competitor.name,
            url: competitor.url,
            industry: competitor.industry,
          },
        ],
      }),
    })
  );

  return {
    statusCode: 202,
    body: { data: { message: 'Deep research started. Findings will appear shortly.' } },
  };
});
