"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import type { ShareOfVoiceWindowKey } from "@/lib/types";

export function useShareOfVoice(window: ShareOfVoiceWindowKey) {
  return useQuery({
    queryKey: ["analytics", "share-of-voice", window],
    queryFn: () => analyticsApi.shareOfVoice(window),
    staleTime: 60_000,
  });
}
