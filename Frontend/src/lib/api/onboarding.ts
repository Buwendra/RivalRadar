import { apiClient } from "./client";

export interface SuggestCompetitorsInput {
  companyName: string;
  companyUrl: string;
  industry: string;
}

export interface SuggestedCompetitor {
  name: string;
  url: string;
  rationale: string;
  confidence: "high" | "medium" | "low";
}

export const onboardingApi = {
  suggestCompetitors: (input: SuggestCompetitorsInput) =>
    apiClient<{ suggestions: SuggestedCompetitor[] }>(
      "/onboarding/suggest-competitors",
      {
        method: "POST",
        body: input,
      }
    ),
};
