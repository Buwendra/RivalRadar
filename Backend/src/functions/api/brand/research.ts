/**
 * POST /brand/research
 *
 * Phase 23 — Brand Pulse. Triggers an on-demand deep-research pass on the
 * workspace's self-brand row. Mirrors `competitors/research.ts` end-to-end:
 * eligibility gate, ResearchRun observability row, Step Functions start.
 * Returns 404 if the workspace has no self-brand row yet (frontend should
 * call /brand/setup first).
 */

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { enforceResearchEligibility } from '../../../shared/utils/research-eligibility';
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
import { loadSelfBrand, loadUserForBrand, assertBrandPulseCapability } from './_shared';

const sfn = new SFNClient({});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await loadUserForBrand(userId);
  assertBrandPulseCapability(user);

  const self = await loadSelfBrand(userId);
  if (!self) {
    throw new HttpError(404, 'BRAND_NOT_SET_UP', 'Set up your brand profile before running research.');
  }

  // Misuse-defense gate — same surface as competitor research. Self-brand
  // is still subject to the per-user daily quota + sanctions/classifier.
  const eligibility = await enforceResearchEligibility({
    user,
    competitors: [{ name: self.name, url: self.url }],
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

  const runId = generateId();
  const run = await createResearchRun({
    id: runId,
    tenantUserId: userId,
    competitorId: self.id,
    competitorName: self.name,
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
              competitorId: self.id,
              userId,
              tenantUserId: userId,
              runId,
              runStartedAt: run.startedAt,
              name: self.name,
              url: self.url,
              industry: self.industry,
              targetKind: 'self',
            },
          ],
        }),
      })
    );
    executionArn = result.executionArn;
  } catch (err) {
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
        message: 'Brand research started. Findings will appear shortly.',
        runId,
      },
    },
  };
});
