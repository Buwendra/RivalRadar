import { apiClient, apiClientWithMeta } from "./client";
import type {
  WorkspaceSummary,
  WorkspaceMember,
  InvitationCreatedResponse,
  AcceptInvitationResponse,
  AuditEventListItem,
  PaginationMeta,
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

  rename: (name: string) =>
    apiClient<{ workspaceId: string; name: string }>("/workspaces/current", {
      method: "PATCH",
      body: { name },
    }),

  transferOwnership: (newOwnerUserId: string) =>
    apiClient<{ workspaceId: string; ownerUserId: string }>(
      "/workspaces/current/transfer-ownership",
      { method: "POST", body: { newOwnerUserId } }
    ),

  remove: () =>
    apiClient<{ workspaceId: string; deleted: boolean }>("/workspaces/current", {
      method: "DELETE",
    }),

  listAuditEvents: async (params?: { cursor?: string; limit?: number }) => {
    const response = await apiClientWithMeta<AuditEventListItem[]>(
      "/workspaces/current/audit",
      { params: { cursor: params?.cursor, limit: params?.limit ?? 50 } }
    );
    return {
      data: response.data ?? [],
      meta: (response.meta ?? { hasMore: false }) as PaginationMeta,
    };
  },
};
