/**
 * Phase 24 — analytics surface (currently just Share of Voice).
 * Lives outside `brand.ts` because SoV spans the whole workspace (self + competitors).
 */

import { apiClient } from "./client";
import type { ShareOfVoiceResponse, ShareOfVoiceWindowKey } from "@/lib/types";

export const analyticsApi = {
  shareOfVoice: (window: ShareOfVoiceWindowKey) =>
    apiClient<ShareOfVoiceResponse>("/analytics/share-of-voice", {
      params: { window },
    }),
};
