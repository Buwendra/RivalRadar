/**
 * GET /research-runs/{id}/details
 *
 * Phase 22 — lazy "Technical details" endpoint for a single run. Pulls
 * Step Function execution history + a CloudWatch log tail filtered by
 * runId. Called only when the user clicks the disclosure button — keeps
 * the list-view query cheap.
 *
 * Failure modes degrade rather than fail the whole response: if either
 * the SFN or CloudWatch fetch errors, the corresponding field returns
 * empty. The UI shows what it has.
 */

import {
  SFNClient,
  GetExecutionHistoryCommand,
} from '@aws-sdk/client-sfn';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import {
  researchRunPK,
  researchRunSKPrefix,
} from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { logger } from '../../../shared/utils/logger';
import type { ResearchRun } from '../../../shared/types';

const sfn = new SFNClient({});
const cloudwatch = new CloudWatchLogsClient({});

interface SfnEvent {
  type: string;
  timestamp: string;
  stateName?: string;
  error?: string;
  cause?: string;
}

interface LogLine {
  timestamp: string;
  message: string;
}

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const id = event.pathParameters?.id;
  if (!id) throw new HttpError(400, 'MISSING_ID', 'Run ID is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  const { items } = await queryByPK(
    researchRunPK(ctx.tenantUserId),
    researchRunSKPrefix(),
    { scanForward: false, limit: 50 }
  );
  const row = (items as unknown as ResearchRun[]).find((r) => r.id === id);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Research run not found');

  // ─── Step Function history ───
  let sfnEvents: SfnEvent[] = [];
  if (row.executionArn) {
    try {
      const result = await sfn.send(
        new GetExecutionHistoryCommand({
          executionArn: row.executionArn,
          maxResults: 100,
          reverseOrder: false,
        })
      );
      sfnEvents = (result.events ?? []).map((e) => {
        const stateName =
          e.stateEnteredEventDetails?.name ??
          e.stateExitedEventDetails?.name ??
          undefined;
        const failure =
          e.executionFailedEventDetails ??
          e.lambdaFunctionFailedEventDetails ??
          e.taskFailedEventDetails;
        const ts = e.timestamp instanceof Date ? e.timestamp : new Date();
        return {
          type: String(e.type ?? 'Unknown'),
          timestamp: ts.toISOString(),
          stateName,
          error: failure?.error,
          cause: failure?.cause?.slice(0, 400),
        };
      });
    } catch (err) {
      logger.warn('research_run_details_sfn_failed', {
        runId: id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── CloudWatch tail filtered by runId ───
  // Log group name follows the CDK convention: /aws/lambda/<functionName>.
  // The DeepResearch Lambda's exact name is plumbed in via env at deploy time.
  const lambdaName = process.env.DEEP_RESEARCH_LAMBDA_NAME;
  if (!lambdaName) {
    return {
      statusCode: 200,
      body: {
        data: {
          runId: id,
          executionArn: row.executionArn,
          sfnEvents,
          logLines: [],
          logsConfigured: false,
        },
      },
    };
  }
  const logGroupName = `/aws/lambda/${lambdaName}`;
  let logLines: LogLine[] = [];
  try {
    const start = row.startedAt ? Date.parse(row.startedAt) - 5_000 : Date.now() - 60 * 60 * 1000;
    const result = await cloudwatch.send(
      new FilterLogEventsCommand({
        logGroupName,
        startTime: start,
        filterPattern: `"${id}"`,
        limit: 200,
      })
    );
    logLines = (result.events ?? [])
      .map((e) => ({
        timestamp: new Date(e.timestamp ?? 0).toISOString(),
        message: (e.message ?? '').slice(0, 1000),
      }))
      .slice(-200);
  } catch (err) {
    logger.warn('research_run_details_logs_failed', {
      runId: id,
      logGroupName,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    statusCode: 200,
    body: {
      data: {
        runId: id,
        executionArn: row.executionArn,
        sfnEvents,
        logLines,
      },
    },
  };
});
