"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspacesApi } from "@/lib/api/workspaces";

export const CURRENT_WORKSPACE_STORAGE_KEY = "rs_current_workspace_id";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces", "list"],
    queryFn: workspacesApi.list,
    staleTime: 60_000,
  });
}

export function useWorkspaceMembers() {
  return useQuery({
    queryKey: ["workspaces", "members"],
    queryFn: workspacesApi.listMembers,
    staleTime: 30_000,
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role?: "member" | "admin" }) =>
      workspacesApi.invite(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces", "members"] }),
  });
}

export function useChangeMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "member" | "admin" }) =>
      workspacesApi.changeMemberRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces", "members"] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => workspacesApi.removeMember(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces", "members"] }),
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) => workspacesApi.acceptInvitation(token),
  });
}

export function useRenameWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => workspacesApi.rename(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => workspacesApi.remove(),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useTransferOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (newOwnerUserId: string) =>
      workspacesApi.transferOwnership(newOwnerUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useWorkspaceAuditLog() {
  return useQuery({
    queryKey: ["workspaces", "audit"],
    queryFn: () => workspacesApi.listAuditEvents(),
    staleTime: 30_000,
  });
}
