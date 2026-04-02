"use client";

import { useQuery } from "@tanstack/react-query";
import { competitorsApi } from "@/lib/api/competitors";

export function useCompetitorDetail(id: string) {
  return useQuery({
    queryKey: ["competitors", id],
    queryFn: () => competitorsApi.get(id),
    enabled: !!id,
  });
}
