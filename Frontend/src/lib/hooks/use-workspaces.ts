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
    mutationFn: (email: string) => workspacesApi.invite(email),
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
