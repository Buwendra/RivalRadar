/**
 * ResearchRun helpers (Phase 22).
 *
 * Low-level writers used by the trigger handlers and the pipeline Lambda.
 * Mirror the Phase 4b `recordAuditEvent` / Phase 18 `enqueueNotification`
 * patterns: write failures log + continue, never roll back the underlying
 * mutation. Observability rows are best-effort.
 *
 * Per-event writes are bundled in memory and flushed in one update at the
 * end of a Lambda invocation — see `flushEventsToRun` for the writer used
 * by `pipeline/deep-research.ts`. The trigger handlers use `createResearchRun`
 * to mint the initial queued row and `markRunStarted` once SFN has accepted
 * the execution.
 */

import { appendToList, putItem, updateItem } from '../db/queries';
import {
  researchRunPK,
  researchRunSK,
} from '../db/keys';
import { logger } from '../utils/logger';
import type {
  ApplicationEvent,
  ResearchRun,
  ResearchRunStatus,
  ResearchTriggerSource,
} from '../types';

const TTL_DAYS = 90;
const MAX_EVENTS = 50;

export interface CreateResearchRunInput {
  id: string;
  tenantUserId: string;
  competitorId: string;
  competitorName: string;
  triggeredByUserId: string;
  triggeredByEmail: string;
  triggerSource: ResearchTriggerSource;
}

/**
 * Create a queued ResearchRun row. Called by the trigger handler BEFORE
 * `StartExecution` so the dashboard panel reflects the run within ~1s of
 * the user's click.
 */
export async function createResearchRun(
  input: CreateResearchRunInput
): Promise<ResearchRun> {
  const now = new Date();
  const startedAt = now.toISOString();
  const expiresAt = Math.floor(now.getTime() / 1000) + TTL_DAYS * 24 * 60 * 60;

  const row: ResearchRun = {
    id: input.id,
    tenantUserId: input.tenantUserId,
    competitorId: input.competitorId,
    competitorName: input.competitorName,
    triggeredByUserId: input.triggeredByUserId,
    triggeredByEmail: input.triggeredByEmail,
    triggerSource: input.triggerSource,
    status: 'queued',
    startedAt,
    events: [
      {
        ts: startedAt,
        level: 'info',
        message: 'run_queued',
        data: { triggerSource: input.triggerSource },
      },
    ],
    expiresAt,
  };

  try {
    await putItem({
      PK: researchRunPK(input.tenantUserId),
      SK: researchRunSK(startedAt, input.id),
      ...row,
    });
  } catch (err) {
    logger.warn('research_run_create_failed', {
      runId: input.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return row;
}

/**
 * Flip queued → running and stamp the executionArn. Called by the trigger
 * handler immediately after `StartExecution` succeeds. Best-effort.
 */
export async function markRunStarted(
  tenantUserId: string,
  startedAt: string,
  id: string,
  executionArn: string
): Promise<void> {
  try {
    await updateItem(
      researchRunPK(tenantUserId),
      researchRunSK(startedAt, id),
      {
        status: 'running' as ResearchRunStatus,
        runStartedAt: new Date().toISOString(),
        executionArn,
      }
    );
  } catch (err) {
    logger.warn('research_run_mark_started_failed', {
      runId: id,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface MarkRunFinishedInput {
  status: 'succeeded' | 'failed';
  deltaCount?: number;
  citationCount?: number;
  errorMessage?: string;
  events?: ApplicationEvent[];
}

/**
 * Terminal state writer. Pipeline Lambda calls this once at end-of-run.
 * Optionally accepts the accumulated event log to flush in the same write.
 */
export async function markRunFinished(
  tenantUserId: string,
  startedAt: string,
  id: string,
  input: MarkRunFinishedInput
): Promise<void> {
  const updates: Record<string, unknown> = {
    status: input.status,
    finishedAt: new Date().toISOString(),
  };
  if (typeof input.deltaCount === 'number') updates.deltaCount = input.deltaCount;
  if (typeof input.citationCount === 'number')
    updates.citationCount = input.citationCount;
  if (input.errorMessage) updates.errorMessage = input.errorMessage.slice(0, 800);

  try {
    await updateItem(
      researchRunPK(tenantUserId),
      researchRunSK(startedAt, id),
      updates
    );
    // APPEND events rather than SET — a wholesale SET replaced the
    // `run_queued` entry the trigger handler wrote, losing the timeline's
    // first event. Callers pass only the not-yet-flushed tail.
    if (input.events && input.events.length > 0) {
      await appendToList(
        researchRunPK(tenantUserId),
        researchRunSK(startedAt, id),
        'events',
        input.events.slice(-MAX_EVENTS)
      );
    }
  } catch (err) {
    logger.warn('research_run_mark_finished_failed', {
      runId: id,
      status: input.status,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Mid-run flush. Used by long-running Lambdas (deep-research can take ~60s)
 * to surface progress to the UI before terminal state. APPENDS — callers
 * pass only events not flushed yet (a wholesale SET used to erase the
 * trigger handler's `run_queued` entry).
 */
export async function flushEventsToRun(
  tenantUserId: string,
  startedAt: string,
  id: string,
  events: ApplicationEvent[]
): Promise<void> {
  if (events.length === 0) return;
  try {
    await appendToList(
      researchRunPK(tenantUserId),
      researchRunSK(startedAt, id),
      'events',
      events.slice(-MAX_EVENTS)
    );
  } catch (err) {
    logger.warn('research_run_flush_events_failed', {
      runId: id,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Create an `ApplicationEvent` with a current ISO timestamp. Sugar so call
 * sites stay one-liners.
 */
export function makeRunEvent(
  message: string,
  data?: Record<string, string | number | boolean>,
  level: ApplicationEvent['level'] = 'info'
): ApplicationEvent {
  return {
    ts: new Date().toISOString(),
    level,
    message,
    ...(data ? { data } : {}),
  };
}
