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
