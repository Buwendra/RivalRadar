export type ResearchRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export type ResearchTriggerSource = "onboarding" | "manual" | "recurring";

export interface ApplicationEvent {
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, string | number | boolean>;
}

/** Row returned by GET /research-runs (events truncated to last 5). */
export interface ResearchRunSummary {
  id: string;
  competitorId: string;
  competitorName: string;
  triggeredByUserId: string;
  triggeredByEmail: string;
  triggerSource: ResearchTriggerSource;
  status: ResearchRunStatus;
  startedAt: string;
  runStartedAt?: string;
  finishedAt?: string;
  deltaCount?: number;
  citationCount?: number;
  errorMessage?: string;
  events: ApplicationEvent[];
  hasMoreEvents: boolean;
}

/** Row returned by GET /research-runs/{id} (full event log). */
export interface ResearchRunDetail extends Omit<ResearchRunSummary, "events" | "hasMoreEvents"> {
  executionArn?: string;
  events: ApplicationEvent[];
}

export interface SfnHistoryEvent {
  type: string;
  timestamp: string;
  stateName?: string;
  error?: string;
  cause?: string;
}

export interface CloudwatchLogLine {
  timestamp: string;
  message: string;
}

export interface ResearchRunTechnicalDetails {
  runId: string;
  executionArn?: string;
  sfnEvents: SfnHistoryEvent[];
  logLines: CloudwatchLogLine[];
  /** False when the backend can't resolve the log group (env not configured). */
  logsConfigured?: boolean;
}
