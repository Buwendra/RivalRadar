// ─── Primary Key Builders ───

export const userPK = (userId: string) => `USER#${userId}`;
export const userSK = () => 'PROFILE';

export const subscriptionPK = (userId: string) => `USER#${userId}`;
export const subscriptionSK = () => 'SUB';

export const competitorPK = (userId: string) => `USER#${userId}`;
export const competitorSK = (competitorId: string) => `COMP#${competitorId}`;

export const changePK = (competitorId: string) => `COMP#${competitorId}`;
export const changeSK = (timestamp: string) => `CHANGE#${timestamp}`;
// Direct change-by-id lookup (GET /changes/{id}). Changes are keyed by
// timestamp, so an id-only permalink used to scan the newest N rows and 404
// past that. GSI3 is KEYS_ONLY — resolve the PK/SK pair here, then getItem
// the full row (same two-hop as the battlecard token below). GSI3SK carries
// the competitorId so the base-table PK is recoverable without a scan.
export const changeIdGSI3 = (changeId: string, competitorId: string) => ({
  GSI3PK: `CHANGE_ID#${changeId}`,
  GSI3SK: `COMP#${competitorId}`,
});

// NOTE: the Firecrawl-era Snapshot entity (`SNAP#` SK prefix) is no longer
// written; its key builders were removed. The prefix stays conceptually
// reserved so old rows are never collided with.

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

// Workspace / Membership / Invitation (Phase 4a)
export const workspacePK = (workspaceId: string) => `WORKSPACE#${workspaceId}`;
export const workspaceSK = () => 'PROFILE';

// Per-user membership lookup — list a user's workspaces (PK already USER#<id>)
export const membershipByUserPK = (userId: string) => `USER#${userId}`;
export const membershipByUserSK = (workspaceId: string) =>
  `MEMBERSHIP#${workspaceId}`;
export const membershipByUserSKPrefix = () => 'MEMBERSHIP#';

// Per-workspace member list — list a workspace's members (reverse direction)
export const memberByWorkspacePK = (workspaceId: string) =>
  `WORKSPACE#${workspaceId}`;
export const memberByWorkspaceSK = (userId: string) => `MEMBER#${userId}`;
export const memberByWorkspaceSKPrefix = () => 'MEMBER#';

// Invitation — keyed by opaque ULID token (mirrors Phase 8b cancellation pattern)
export const invitationPK = (token: string) => `INVITE#${token}`;
export const invitationSK = () => 'META';

// SavedView — named filter combinations on the change feed (Phase 7b).
// Keyed under the tenant owner's user row so all workspace members share them.
export const savedViewPK = (tenantUserId: string) => `USER#${tenantUserId}`;
export const savedViewSK = (viewId: string) => `VIEW#${viewId}`;
export const savedViewSKPrefix = () => 'VIEW#';

// SavedViewSubscription — per-caller weekly email subscription (Phase 15).
// Keyed under the SUBSCRIBER's user row (not the tenant owner's): each
// member subscribes independently.
export const savedViewSubscriptionPK = (subscriberUserId: string) =>
  `USER#${subscriberUserId}`;
export const savedViewSubscriptionSK = (workspaceId: string, viewId: string) =>
  `VIEW_SUB#${workspaceId}#${viewId}`;
export const savedViewSubscriptionSKPrefix = () => 'VIEW_SUB#';

// AuditEvent — workspace-scoped activity log (Phase 4b). Double-segment SK
// lets us paginate cleanly when two events share a millisecond.
export const auditEventPK = (workspaceId: string) => `WORKSPACE#${workspaceId}`;
export const auditEventSK = (timestamp: string, id: string) =>
  `AUDIT#${timestamp}#${id}`;
export const auditEventSKPrefix = () => 'AUDIT#';

// AuthAuditEvent — workspace-less audit rows for signin/signup events
// (Phase 9 final wave). Bucketed monthly so forensic scans stay cheap.
export const authAuditPK = (yyyymm: string) => `AUTH_AUDIT#${yyyymm}`;
export const authAuditSK = (timestamp: string, id: string) =>
  `EVENT#${timestamp}#${id}`;
export const authAuditSKPrefix = () => 'EVENT#';

// ApiKey — public-API credential, double-write (Phase 11). The auth-lookup
// row is hashed (no plaintext at rest); the workspace mirror enables the
// owner-facing list endpoint.
export const apiKeyByHashPK = (keyHash: string) => `APIKEY#${keyHash}`;
export const apiKeyByHashSK = () => 'META';
export const apiKeyByWorkspacePK = (workspaceId: string) =>
  `WORKSPACE#${workspaceId}`;
export const apiKeyByWorkspaceSK = (id: string) => `APIKEY#${id}`;
export const apiKeyByWorkspaceSKPrefix = () => 'APIKEY#';

// Notification — per-user in-app feed (Phase 18). Distinct from the
// workspace audit log (which is owner-only + compliance-oriented).
// Double-segment SK paginates cleanly when two events land in the same ms.
export const notificationPK = (recipientUserId: string) =>
  `USER#${recipientUserId}`;
export const notificationSK = (timestamp: string, id: string) =>
  `NOTIF#${timestamp}#${id}`;
export const notificationSKPrefix = () => 'NOTIF#';

// Battlecard — per-competitor PDF + public share token (Phase 20).
// Listed under the tenant owner so workspace members share visibility.
// `battlecardTokenGSI3` mints the GSI3 PK/SK pair used to resolve a public
// share token to its row in a single query.
export const battlecardPK = (tenantUserId: string) => `USER#${tenantUserId}`;
export const battlecardSK = (createdAt: string, id: string) =>
  `BATTLECARD#${createdAt}#${id}`;
export const battlecardSKPrefix = () => 'BATTLECARD#';
export const battlecardTokenGSI3 = (token: string) => ({
  GSI3PK: `BATTLECARD_TOKEN#${token}`,
  GSI3SK: `BATTLECARD_TOKEN#${token}`,
});

// ResearchRun — per-execution status + event log (Phase 22). Listed under
// the tenant owner so workspace members share visibility. Double-segment SK
// paginates cleanly when two runs share a millisecond (onboarding bursts).
export const researchRunPK = (tenantUserId: string) => `USER#${tenantUserId}`;
export const researchRunSK = (startedAt: string, id: string) =>
  `RUN#${startedAt}#${id}`;
export const researchRunSKPrefix = () => 'RUN#';

// AudioBriefing — weekly digest TTS narration (Phase 2 demo-wow). Same
// double-segment SK pattern as Battlecard / ResearchRun. Latest row is
// read by the profile handler to render the dashboard <audio> card; older
// rows are retained for 90 days and rotate naturally.
export const audioBriefingPK = (tenantUserId: string) => `USER#${tenantUserId}`;
export const audioBriefingSK = (generatedAt: string, id: string) =>
  `AUDIO#${generatedAt}#${id}`;
export const audioBriefingSKPrefix = () => 'AUDIO#';

// AILog — forensic audit row per Anthropic call (Issue 9 / Compliance Phase 1.5).
// Monthly bucketed PK so a defamation-claim drill can scan a single month
// in one DDB query. 1-year TTL via expiresAt.
export const aiLogPK = (yyyymm: string) => `AILOG#${yyyymm}`;
export const aiLogSK = (createdAt: string, aiCallId: string) =>
  `CALL#${createdAt}#${aiCallId}`;
export const aiLogSKPrefix = () => 'CALL#';

// RateLimit bucket — Anthropic input-TPM token bucket (Issue 8). One row
// per minute under a single PK; pre-call ADD writes + read in the same
// callAnthropic invocation. 2-minute TTL.
export const rateLimitPK = () => 'RATELIMIT#ANTHROPIC_INPUT_TPM';
export const rateLimitSK = (minuteKey: string) => `MINUTE#${minuteKey}`;

// Auth rate-limit window — durable per-identifier fixed window for the public
// auth endpoints (signin / signup / resend-verification). One row per
// (scope, identifier); self-cleans via expiresAt TTL shortly after the
// window closes. See shared/utils/auth-rate-limit.ts.
export const authRateLimitPK = (scope: string, identifier: string) =>
  `RATELIMIT#AUTH#${scope}#${identifier}`;
export const authRateLimitSK = () => 'WINDOW';

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

/** Parse entity type from PK */
export function entityType(pk: string): 'USER' | 'COMP' | 'UNKNOWN' {
  if (pk.startsWith('USER#')) return 'USER';
  if (pk.startsWith('COMP#')) return 'COMP';
  return 'UNKNOWN';
}
