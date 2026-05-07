import { apiClient } from "./client";
import type { CompetitorMatrixRow } from "@/lib/types";

export const matrixApi = {
  list: () => apiClient<CompetitorMatrixRow[]>("/competitors/matrix"),
};
