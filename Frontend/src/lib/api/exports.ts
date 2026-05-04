import { apiClient } from "./client";

export type CsvExportType = "changes" | "competitors" | "recommendations";

export interface CsvExportResponse {
  csv: string;
  filename: string;
  rowCount: number;
  type: CsvExportType;
}

export const exportsApi = {
  csv: (type: CsvExportType, since?: string) =>
    apiClient<CsvExportResponse>("/exports/csv", {
      method: "POST",
      body: { type, ...(since ? { since } : {}) },
    }),
};

/**
 * Download the CSV string as a file via Blob. Triggers an immediate browser
 * download with the suggested filename. Returns nothing — the browser is the
 * "result". Caller is responsible for surrounding loading state + toast.
 */
export function triggerCsvDownload(input: { csv: string; filename: string }): void {
  const blob = new Blob([input.csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = input.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after the click handler has fired; small delay covers slow Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
