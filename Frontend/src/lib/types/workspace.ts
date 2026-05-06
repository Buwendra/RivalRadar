export type WorkspaceRole = "owner" | "member";

export interface WorkspaceSummary {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceMember {
  userId: string;
  email?: string;
  role: WorkspaceRole;
  joinedAt: string;
  isYou: boolean;
}

export interface InvitationCreatedResponse {
  token: string;
  workspaceName: string;
  inviteeEmail: string;
  expiresAt: string;
}

export interface AcceptInvitationResponse {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
}

export type AuditAction =
  | "workspace.renamed"
  | "workspace.deleted"
  | "workspace.invitation_created"
  | "workspace.invitation_accepted"
  | "workspace.member_removed"
  | "integration.connected"
  | "integration.disconnected"
  | "competitor.deleted"
  | "subscription.checkout_started"
  | "subscription.portal_opened"
  | "gdpr.export_requested"
  | "gdpr.deletion_requested"
  | "account.suspended"
  | "account.resumed";

export interface AuditEventListItem {
  id: string;
  actorUserId: string;
  actorEmail: string;
  action: AuditAction;
  resourceId?: string;
  resourceLabel?: string;
  meta?: Record<string, string | number | boolean>;
  sourceIp?: string;
  userAgent?: string;
  createdAt: string;
}
