import { apiClient } from "./client";
import type { User, PageType } from "@/lib/types";

export interface OnboardInput {
  companyName: string;
  industry: string;
  competitors: Array<{
    name: string;
    url: string;
    pagesToTrack: PageType[];
  }>;
  tosVersion?: string;
  privacyVersion?: string;
}

export interface OnboardResponse {
  message: string;
  competitorIds: string[];
}

export const usersApi = {
  getProfile: () => apiClient<User>("/users/me"),

  updateProfile: (data: { name?: string }) =>
    apiClient<{ message: string }>("/users/me", {
      method: "PUT",
      body: data,
    }),

  onboard: (data: OnboardInput) =>
    apiClient<OnboardResponse>("/users/onboard", {
      method: "POST",
      body: data,
    }),
};
