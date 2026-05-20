/**
 * Phase 24 — opt-in subscriber list for the Comparative Weekly Briefing.
 * Mirrors `get-subscribers.ts` (table scan over USER PROFILE rows) but adds
 * three filters: opt-in flag, capability check, self-brand row existence.
 *
 * Output is the same shape as `get-subscribers.ts` so the rest of the Map
 * pipeline can reuse the per-subscriber payload structure verbatim.
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../../shared/db/client';
import { queryByPK } from '../../shared/db/queries';
import { competitorPK } from '../../shared/db/keys';
import { hasCapability } from '../../shared/utils/capability';
import { logger } from '../../shared/utils/logger';
import type { User } from '../../shared/types';

interface Subscriber {
  userId: string;
  email: string;
  name: string;
  plan: string;
}

export const handler = async (): Promise<{ subscribers: Subscriber[] }> => {
  const candidates: Array<Record<string, unknown>> = [];
  let lastKey: Record<string, unknown> | undefined;

  // Scan PROFILE rows that are onboarded AND have the comparative-brief
  // email opt-in set true. notificationPreferences is a nested map, so the
  // filter uses dotted paths on the attribute.
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          'SK = :sk AND onboardingComplete = :oc AND notificationPreferences.email.comparativeBrief = :true',
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
          ':oc': true,
          ':true': true,
        },
        ExclusiveStartKey: lastKey,
      })
    );
    for (const item of result.Items ?? []) candidates.push(item);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  // Capability + self-brand existence checks. Done in app code rather than
  // the FilterExpression so we don't have to encode the capability matrix
  // into DynamoDB query parameters.
  const subscribers: Subscriber[] = [];
  for (const item of candidates) {
    const user = item as unknown as User;
    if (!hasCapability(user, 'brandPulse')) continue;
    const { items: rows } = await queryByPK(competitorPK(user.id), 'COMP#');
    const hasSelf = (rows as Array<Record<string, unknown>>).some(
      (r) => r.targetKind === 'self'
    );
    if (!hasSelf) continue;
    subscribers.push({
      userId: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });
  }

  logger.info('GetComparativeSubscribers completed', {
    candidateCount: candidates.length,
    subscriberCount: subscribers.length,
  });
  return { subscribers };
};
