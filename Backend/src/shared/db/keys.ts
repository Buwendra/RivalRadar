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

export const researchPK = (competitorId: string) => `COMP#${competitorId}`;
export const researchSK = (timestamp: string) => `RESEARCH#${timestamp}`;

// CostDay — per-user daily Anthropic cost rollup (Phase 1)
export const costDayPK = (userId: string) => `USER#${userId}`;
export const costDaySK = (date: string) => `COST#${date}`; // date in YYYY-MM-DD

// Recommendation — per-user weekly strategic recommendations (Phase 2)
export const recommendationPK = (userId: string) => `USER#${userId}`;
export const recommendationSK = (timestamp: string) => `REC#${timestamp}`;

// IntegrationCredential — per-user (provider) notification webhook URLs (Phase 3)
export const integrationPK = (userId: string) => `USER#${userId}`;
export const integrationSK = (provider: string) => `INTEGRATION#${provider}`;

// ChangeNote — analyst annotation on a Change (Phase 7a)
export const changeNotePK = (competitorId: string) => `COMP#${competitorId}`;
export const changeNoteSK = (changeId: string, timestamp: string) =>
  `NOTE#${changeId}#${timestamp}`;
export const changeNoteSKPrefix = (changeId: string) => `NOTE#${changeId}#`;

// CancellationFeedback — exit-survey response keyed by opaque token (Phase 8b)
export const cancelFeedbackPK = (token: string) => `CANCEL_FEEDBACK#${token}`;
export const cancelFeedbackSK = () => 'META';

// OFAC SDN drift tracker — single row holds the last-fetched hash (Phase 9b)
export const ofacSdnPK = () => 'OFAC_SDN';
export const ofacSdnSK = () => 'META';

// ─── GSI Key Builders ───

// GSI1: User's changes feed (dashboard)
export const gsi1ChangeKeys = (userId: string, timestamp: string) => ({
  GSI1PK: userId,
  GSI1SK: `CHANGE#${timestamp}`,
});

// GSI1: User's research findings feed
export const gsi1ResearchKeys = (userId: string, timestamp: string) => ({
  GSI1PK: userId,
  GSI1SK: `RESEARCH#${timestamp}`,
});

// GSI1: User's recommendations feed (Phase 2)
export const gsi1RecommendationKeys = (userId: string, timestamp: string) => ({
  GSI1PK: userId,
  GSI1SK: `REC#${timestamp}`,
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
