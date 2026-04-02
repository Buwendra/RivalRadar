import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../../shared/db/client';
import { logger } from '../../shared/utils/logger';

interface Subscriber {
  userId: string;
  email: string;
  name: string;
  plan: string;
}

/**
 * Step Function Lambda: Get all active subscribers for weekly digest.
 */
export const handler = async (): Promise<{ subscribers: Subscriber[] }> => {
  const subscribers: Subscriber[] = [];
  let lastKey: Record<string, unknown> | undefined;

  // Scan for user profiles with active subscriptions
  // In production, consider a GSI on plan status for efficiency
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'SK = :sk AND onboardingComplete = :oc',
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
          ':oc': true,
        },
        ProjectionExpression: 'id, email, #n, #p',
        ExpressionAttributeNames: {
          '#n': 'name',
          '#p': 'plan',
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      subscribers.push({
        userId: item.id as string,
        email: item.email as string,
        name: item.name as string,
        plan: item.plan as string,
      });
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  logger.info('GetSubscribers completed', { count: subscribers.length });
  return { subscribers };
};
