import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { getItem } from '../../../shared/db/queries';
import { competitorPK, competitorSK, userPK, userSK } from '../../../shared/db/keys';
import { enforceResearchEligibility } from '../../../shared/utils/research-eligibility';
import { isSnoozed } from '../../../shared/utils/snooze';
import { generateId } from '../../../shared/utils/id';
import {
  createResearchRun,
  markRunFinished,
  markRunStarted,
} from '../../../shared/services/research-run';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { User } from '../../../shared/types/user';

const sfn = new SFNClient({});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const compId = event.pathParameters?.id;

  if (!compId) throw new HttpError(400, 'MISSING_ID', 'Competitor ID is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const [user, competitor] = await Promise.all([
    getItem<User & Record<string, unknown>>(userPK(userId), userSK()),
    getItem<Record<string, unknown>>(competitorPK(userId), competitorSK(compId)),
  ]);
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  if (!competitor) throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');

  // Phase 7a — block manual research on snoozed competitors. Frontend hides
  // the button when snoozed; this is the backend backstop.
  if (isSnoozed(competitor as { snoozedUntil?: string })) {
    throw new HttpError(
      409,
      'COMPETITOR_SNOOZED',
      'This competitor is snoozed. Un-snooze before running research.'
    );
  }

  // Misuse-defense gate: status check + sanctions denylist + rate limit + Haiku classifier.
  // Failures here surface as 4xx with an actionable reason (and the rate-limit reset window
  // when applicable). The competitor is already in the DB so the classifier mostly catches
  // edge cases like the user editing the URL to something inappropriate post-creation.
  const eligibility = await enforceResearchEligibility({
    user,
    competitors: [{ name: String(competitor.name), url: String(competitor.url) }],
  });
  if (!eligibility.allowed) {
    const status = eligibility.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 403;
    throw new HttpError(
      status,
      eligibility.code ?? 'NOT_ALLOWED',
      eligibility.reason ?? 'Research is not allowed for this target.'
    );
  }

  if (!process.env.RESEARCH_PIPELINE_ARN) {
    throw new HttpError(503, 'PIPELINE_NOT_CONFIGURED', 'Research pipeline not configured');
  }

  // Phase 22 — observability row. Created BEFORE StartExecution so the
  // dashboard panel reflects the run within ~1s of the click. The runId
  // travels into the SFN input so the pipeline Lambda can advance the row.
  const runId = generateId();
  const run = await createResearchRun({
    id: runId,
    tenantUserId: userId,
    competitorId: compId,
    competitorName: String(competitor.name),
    triggeredByUserId: ctx.callerUserId,
    triggeredByEmail: ctx.callerEmail,
    triggerSource: 'manual',
  });

  let executionArn: string | undefined;
  try {
    const result = await sfn.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.RESEARCH_PIPELINE_ARN,
        input: JSON.stringify({
          competitors: [
            {
              competitorId: compId,
              userId,
              tenantUserId: userId,
              runId,
              runStartedAt: run.startedAt,
              name: competitor.name,
              url: competitor.url,
              industry: competitor.industry,
            },
          ],
        }),
      })
    );
    executionArn = result.executionArn;
  } catch (err) {
    // SFN failure leaves the row stuck in `queued` — finalise it as failed
    // so the UI shows a clean error rather than a phantom queued row.
    await markRunFinished(userId, run.startedAt, runId, {
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Failed to start research pipeline',
    });
    throw new HttpError(503, 'PIPELINE_START_FAILED', 'Failed to start research pipeline');
  }

  if (executionArn) {
    await markRunStarted(userId, run.startedAt, runId, executionArn);
  }

  return {
    statusCode: 202,
    body: {
      data: {
        message: 'Deep research started. Findings will appear shortly.',
        runId,
      },
    },
  };
});
