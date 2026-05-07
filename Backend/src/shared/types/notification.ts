/**
 * In-app Notification (Phase 18) — per-user, caller-scoped feed of events
 * that affected the recipient. Distinct from the workspace audit log
 * (compliance) — notifications are UX surface for "what happened to me".
 *
 *   PK = USER#<recipientUserId>
 *   SK = NOTIF#<ISO timestamp>#<ULID>
 *
 * Retention: 90 days via DynamoDB TTL (`expiresAt`). Older notifications
 * would be noise — the workspace audit log keeps long-term history.
 */

export type NotificationKind =
  | 'invitation.accepted'
  | 'workspace.member_removed'
  | 'workspace.role_changed'
  | 'workspace.ownership_received'
  | 'workspace.ownership_handed_off';

export interface Notification {
  id: string;
  recipientUserId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Optional in-app deep link. */
  href?: string;
  /** Free-form metadata. Flat values only (DynamoDB attribute friendly). */
  meta?: Record<string, string | number | boolean>;
  /** Set when the recipient marks the notification read. Absent = unread. */
  readAt?: string;
  createdAt: string;
  /** Epoch seconds — DynamoDB TTL (90 days). */
  expiresAt: number;
}
