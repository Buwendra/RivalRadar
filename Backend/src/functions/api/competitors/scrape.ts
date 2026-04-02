import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { getItem, queryGSI } from '../../../shared/db/queries';
import { competitorPK, competitorSK } from '../../../shared/db/keys';

const sfn = new SFNClient({});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const compId = event.pathParameters?.id;

  if (!compId) throw new HttpError(400, 'MISSING_ID', 'Competitor ID is required');

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const competitor = await getItem<Record<string, unknown>>(competitorPK(userId), competitorSK(compId));
  if (!competitor) {
    throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');
  }

  if (!process.env.DAILY_PIPELINE_ARN) {
    throw new HttpError(503, 'PIPELINE_NOT_CONFIGURED', 'Scraping pipeline not configured');
  }

  await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: process.env.DAILY_PIPELINE_ARN,
      input: JSON.stringify({
        competitorIds: [compId],
        userId,
        isManualScrape: true,
      }),
    })
  );

  return {
    statusCode: 202,
    body: { data: { message: 'Scrape started. Changes will appear on your dashboard shortly.' } },
  };
});
