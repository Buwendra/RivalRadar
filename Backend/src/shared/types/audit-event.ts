/**
 * AuditEvent (Phase 4b)
 *
 * Workspace-scoped audit log for governance + B2B procurement security
 * questionnaires. Captures: actor, action, target resource, source IP +
 * user-agent, timestamp.
 *
 *   PK = WORKSPACE#<wsId>
 *   SK = AUDIT#<ISO timestamp>#<ULID>
 *
 * Retention: 90 days via DynamoDB TTL (`expiresAt`). Older evidence lives
 * in CloudTrail (Phase 9b's audit-logs bucket has 7-year object-lock
 * retention) — the in-table audit log is for fast in-app activity views,
 * not the long-term system of record.
 */

export type AuditAction =
  | 'workspace.renamed'
  | 'workspace.deleted'
  | 'workspace.ownership_transferred'
  | 'workspace.invitation_created'
  | 'workspace.invitation_accepted'
  | 'workspace.member_removed'
  | 'workspace.member_role_changed'
  | 'integration.connected'
  | 'integration.disconnected'
  | 'competitor.deleted'
  | 'subscription.checkout_started'
  | 'subscription.portal_opened'
  | 'gdpr.export_requested'
  | 'gdpr.deletion_requested'
  | 'account.suspended'
  | 'account.resumed'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'api.competitor_created'
  | 'api.competitor_snoozed'
  | 'api.recommendation_updated'
  | 'saved_view.webhook_matched'
  | 'auth.signin_succeeded'
  | 'auth.signin_failed'
  | 'auth.signup_started'
  | 'auth.signup_completed';

export interface AuditEvent {
  id: string;
  workspaceId: string;
  actorUserId: string;
  actorEmail: string;
  action: AuditAction;
  /** ULID / provider name / etc. — pinpoints the resource affected. */
  resourceId?: string;
  /** Human-readable label for the resource (competitor name, plan tier). */
  resourceLabel?: string;
  /** Free-form per-action metadata. Keep flat — DynamoDB attribute. */
  meta?: Record<string, string | number | boolean>;
  sourceIp?: string;
  userAgent?: string;
  createdAt: string;
  /** Epoch seconds — DynamoDB TTL. */
  expiresAt: number;
}
