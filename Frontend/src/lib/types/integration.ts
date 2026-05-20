// Mirror of Backend/src/shared/types/integration.ts (read-only client view).
// Backend never returns raw secrets — list endpoint redacts to last-12 hint.

export type IntegrationProvider = "slack" | "webhook";

export interface IntegrationListItem {
  provider: IntegrationProvider;
  /** "…AbCdEf123456" — last 12 chars of the URL, prefixed with an ellipsis. */
  secretHint: string;
  meta?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: "ok" | "failed";
  lastDeliveryError?: string;
}

export interface SetIntegrationResponse {
  provider: IntegrationProvider;
  /** Returned ONCE on webhook creation — show to the user, then forget. */
  hmacSecret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationChannelPreferences {
  weeklyDigest?: boolean;
  criticalAlerts?: boolean;
  /**
   * Phase 24 — PR-flavoured weekly comparative briefing. Email-only at v1;
   * present on the shared channel type for forward compat with Slack/webhook.
   */
  comparativeBrief?: boolean;
}

export interface NotificationPreferences {
  email?: NotificationChannelPreferences;
  slack?: NotificationChannelPreferences;
  webhook?: NotificationChannelPreferences;
}
