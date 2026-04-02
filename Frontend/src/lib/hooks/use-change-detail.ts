"use client";

import { useQuery } from "@tanstack/react-query";
import { changesApi } from "@/lib/api/changes";

export function useChangeDetail(id: string) {
  return useQuery({
    queryKey: ["changes", id],
    queryFn: () => changesApi.get(id),
    enabled: !!id,
  });
}
