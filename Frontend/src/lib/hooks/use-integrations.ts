"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { integrationsApi } from "@/lib/api/integrations";
import type { IntegrationProvider } from "@/lib/types";

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations", "list"],
    queryFn: integrationsApi.list,
    staleTime: 60_000,
  });
}

export function useSetIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: integrationsApi.set,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: (provider: IntegrationProvider) => integrationsApi.test(provider),
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: IntegrationProvider) => integrationsApi.remove(provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
}
