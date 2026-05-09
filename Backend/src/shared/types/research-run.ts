/**
 * Research run observability (Phase 22).
 *
 * Tracks a single execution of the deep-research pipeline (one Lambda
 * invocation = one Map iteration = one ResearchRun row). Created in
 * `queued` status by the trigger handler before `StartExecution`,
 * advanced to `running` once SFN dispatches, and finalised by the
 * pipeline Lambda at end-of-run. Customer-visible — surfaces the
 * "what's happening with my research?" gap.
 */

export type ResearchRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

export type ResearchTriggerSource = 'onboarding' | 'manual' | 'recurring';

export interface ApplicationEvent {
  /** ISO timestamp. */
  ts: string;
  level: 'info' | 'warn' | 'error';
  /** Snake_case event name — e.g. `deep_research_started`. */
  message: string;
  /** Free-form metadata; flat key/value only (DDB-friendly). */
  data?: Record<string, string | number | boolean>;
}

export interface ResearchRun {
  id: string;
  tenantUserId: string;
  competitorId: string;
  competitorName: string;
  triggeredByUserId: string;
  triggeredByEmail: string;
  triggerSource: ResearchTriggerSource;
  status: ResearchRunStatus;
  /** Populated after `StartExecution` returns. May be missing on legacy rows. */
  executionArn?: string;
  /** When the row was created (queued). Always present. */
  startedAt: string;
  /** When the pipeline Lambda picked it up. */
  runStartedAt?: string;
  /** Terminal timestamp. */
  finishedAt?: string;
  deltaCount?: number;
  citationCount?: number;
  errorMessage?: string;
  events: ApplicationEvent[];
  /** Epoch seconds — 90-day TTL matches Step Functions execution retention. */
  expiresAt: number;
}
