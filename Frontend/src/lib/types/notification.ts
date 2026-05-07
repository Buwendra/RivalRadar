export type NotificationKind =
  | "invitation.accepted"
  | "workspace.member_removed"
  | "workspace.role_changed"
  | "workspace.ownership_received"
  | "workspace.ownership_handed_off";

export interface NotificationListItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  meta?: Record<string, string | number | boolean>;
  readAt?: string;
  createdAt: string;
}
