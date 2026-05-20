/**
 * IntegrationCredential — paste-a-URL or generated-secret credential the user
 * configures to receive notifications on a non-email channel (Slack incoming
 * webhook or generic outbound webhook).
 *
 * - `PK = USER#<userId>`, `SK = INTEGRATION#<provider>`
 * - `secret` is treated as sensitive: never logged, never returned in full
 *   from API responses (handlers redact to last-4 + provider).
 *
 * Encryption note: DynamoDB encrypts at rest with AWS-owned keys by default,
 * which is acceptable for v1. A future hardening step is to migrate to a
 * customer-managed KMS CMK so the encryption key is auditable + rotatable;
 * tracked under the Phase 9 "secret rotation runbook" deferred item.
 */

export type IntegrationProvider = 'slack' | 'webhook';

export interface IntegrationCredential {
  userId: string;
  provider: IntegrationProvider;
  /**
   * For `slack`: the incoming-webhook URL the user pasted.
   * For `webhook`: the URL the user wants payloads POSTed to.
   * NEVER returned to the client in full — handlers redact to a last-12 hint.
   */
  secret: string;
  /**
   * For `webhook`: the HMAC-SHA256 secret the user must use to verify
   * payloads on their end. Returned ONCE in the create response so the user
   * can copy it; subsequent reads return only a redacted prefix.
   */
  hmacSecret?: string;
  /** Optional metadata: `{ workspaceName?, channelHint? }` for display. */
  meta?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: 'ok' | 'failed';
  lastDeliveryError?: string;
}

/** Per-event-type opt-in map stored on the User record. */
export interface NotificationPreferences {
  /**
   * `comparativeBrief` (Phase 24) — PR-flavoured weekly digest that runs Mon
   * 10am UTC alongside the standard competitive digest. Email-only at v1;
   * other channels reserved on the type for forward compat but unwired.
   */
  email?: { weeklyDigest?: boolean; criticalAlerts?: boolean; comparativeBrief?: boolean };
  slack?: { weeklyDigest?: boolean; criticalAlerts?: boolean };
  webhook?: { weeklyDigest?: boolean; criticalAlerts?: boolean };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: { weeklyDigest: true, criticalAlerts: true, comparativeBrief: false },
  slack: { weeklyDigest: false, criticalAlerts: true },
  webhook: { weeklyDigest: false, criticalAlerts: true },
};
