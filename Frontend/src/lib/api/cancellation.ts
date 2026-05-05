import { apiClient } from "./client";

export type CancellationReason =
  | "price"
  | "value"
  | "missing-features"
  | "usability"
  | "switched"
  | "no-longer-needed"
  | "temporary-pause"
  | "other";

export const cancellationApi = {
  submit: (token: string, payload: { reason: CancellationReason; freeText?: string }) =>
    apiClient<{ message: string }>(`/cancellation-feedback/${token}`, {
      method: "POST",
      body: payload,
      requireAuth: false,
    }),
};
