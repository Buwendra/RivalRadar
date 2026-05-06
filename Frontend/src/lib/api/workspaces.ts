import { apiClient } from "./client";
import type {
  WorkspaceSummary,
  WorkspaceMember,
  InvitationCreatedResponse,
  AcceptInvitationResponse,
} from "@/lib/types";

export const workspacesApi = {
  list: () => apiClient<WorkspaceSummary[]>("/workspaces"),

  listMembers: () =>
    apiClient<WorkspaceMember[]>("/workspaces/current/members"),

  removeMember: (userId: string) =>
    apiClient<{ removed: boolean; userId: string }>(
      `/workspaces/current/members/${userId}`,
      { method: "DELETE" }
    ),

  invite: (email: string) =>
    apiClient<InvitationCreatedResponse>("/workspaces/current/invitations", {
      method: "POST",
      body: { email },
    }),

  acceptInvitation: (token: string) =>
    apiClient<AcceptInvitationResponse>(`/invitations/${token}/accept`, {
      method: "POST",
    }),
};
