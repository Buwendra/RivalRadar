import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { validate, onboardSchema } from '../../../shared/middleware/validation';
import { putItem, updateItem, queryGSI, getItem } from '../../../shared/db/queries';
import { userPK, userSK, competitorPK, competitorSK, gsi2ActiveCompetitorKeys } from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { PLAN_LIMITS, User } from '../../../shared/types';

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

  // Mark onboarding complete
  await updateItem(userPK(userId), userSK(), {
    onboardingComplete: true,
    companyName: body.companyName,
    industry: body.industry,
    updatedAt: now,
  });

  // Trigger initial scrape via Step Functions (if configured)
  if (process.env.DAILY_PIPELINE_ARN) {
    await sfn.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.DAILY_PIPELINE_ARN,
        input: JSON.stringify({ competitorIds, userId, isInitialScrape: true }),
      })
    );
  }

  return {
    statusCode: 200,
    body: {
      data: {
        message: 'Onboarding complete. Initial scrape started.',
        competitorIds,
      },
    },
  };
});
