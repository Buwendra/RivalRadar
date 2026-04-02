import { createHash } from 'crypto';

// ─── Primary Key Builders ───

export const userPK = (userId: string) => `USER#${userId}`;
export const userSK = () => 'PROFILE';

export const subscriptionPK = (userId: string) => `USER#${userId}`;
export const subscriptionSK = () => 'SUB';

export const competitorPK = (userId: string) => `USER#${userId}`;
export const competitorSK = (competitorId: string) => `COMP#${competitorId}`;

export const changePK = (competitorId: string) => `COMP#${competitorId}`;
export const changeSK = (timestamp: string) => `CHANGE#${timestamp}`;

export const snapshotPK = (competitorId: string) => `COMP#${competitorId}`;
export const snapshotSK = (pageUrl: string, timestamp: string) =>
  `SNAP#${hashPage(pageUrl)}#${timestamp}`;

// ─── GSI Key Builders ───

// GSI1: User's changes feed (dashboard)
export const gsi1ChangeKeys = (userId: string, timestamp: string) => ({
  GSI1PK: userId,
  GSI1SK: `CHANGE#${timestamp}`,
});

// GSI2: Active competitors (for daily cron)
export const gsi2ActiveCompetitorKeys = (competitorId: string) => ({
  GSI2PK: 'ACTIVE',
  GSI2SK: `COMP#${competitorId}`,
});

// GSI3: User by email
export const gsi3EmailKeys = (email: string, userId: string) => ({
  GSI3PK: email.toLowerCase(),
  GSI3SK: `USER#${userId}`,
});

// ─── Helpers ───

/** Hash a page URL to a short deterministic key for DynamoDB sort key */
function hashPage(pageUrl: string): string {
  return createHash('md5').update(pageUrl).digest('hex').slice(0, 8);
}

/** Parse entity type from PK */
export function entityType(pk: string): 'USER' | 'COMP' | 'UNKNOWN' {
  if (pk.startsWith('USER#')) return 'USER';
  if (pk.startsWith('COMP#')) return 'COMP';
  return 'UNKNOWN';
}
