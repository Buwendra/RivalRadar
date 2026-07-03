/**
 * POST /brand/setup
 *
 * Phase 23 — Brand Pulse. Legacy-user setup endpoint. Creates the self-brand
 * Competitor row + persists companyWebsite on the User record + kicks off the
 * first research run. Used by the "Tell us about your brand" CTA on the
 * Your Brand page for users who onboarded before Phase 23.
 *
 * For users who set up self-brand during onboarding (`users/onboard.ts` Phase
 * 23 block), this endpoint short-circuits with 409 to prevent duplicate rows.
 */

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { z } from 'zod';
import {
  apiHandler,
  getUserEmail,
  parseBody,
  HttpError,
} from '../../../shared/middleware/handler';
import { putItem, updateItem } from '../../../shared/db/queries';
import {
  competitorPK,
  competitorSK,
  gsi2ActiveCompetitorKeys,
  userPK,
  userSK,
} from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { validate } from '../../../shared/middleware/validation';
import { enforceResearchEligibility } from '../../../shared/utils/research-eligibility';
import {
  createResearchRun,
  markRunFinished,
  markRunStarted,
} from '../../../shared/services/research-run';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import {
  loadSelfBrand,
  loadUserForBrand,
  assertBrandPulseCapability,
  claimSelfBrandSlot,
  releaseSelfBrandSlot,
} from './_shared';
import { logger } from '../../../shared/utils/logger';

const sfn = new SFNClient({});

const setupSchema = z.object({
  companyName: z.string().min(1).max(100),
  companyWebsite: z.string().url(),
  industry: z.string().min(1).max(100).optional(),
});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(setupSchema, parseBody(event));
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await loadUserForBrand(userId);
  assertBrandPulseCapability(user);

  const existing = await loadSelfBrand(userId);
  if (existing) {
    throw new HttpError(409, 'BRAND_ALREADY_SET_UP', 'Brand profile already exists.');
  }

  // Eligibility check against the user's daily research quota.
  const eligibility = await enforceResearchEligibility({
    user,
    competitors: [{ name: body.companyName, url: body.companyWebsite }],
  });
  if (!eligibility.allowed) {
    const status = eligibility.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 403;
    throw new HttpError(
      status,
      eligibility.code ?? 'NOT_ALLOWED',
      eligibility.reason ?? 'Brand setup not allowed right now.'
    );
  }

  const now = new Date().toISOString();
  const selfId = generateId();
  const industry = body.industry ?? user.industry ?? 'unknown';

  // Atomically claim the one-self-row-per-workspace slot BEFORE creating the
  // row — the loadSelfBrand() pre-check above races with concurrent setups
  // (double-click / retry) and both used to create a self row.
  const claimed = await claimSelfBrandSlot(userId, selfId);
  if (!claimed) {
    throw new HttpError(409, 'BRAND_ALREADY_SET_UP', 'Brand profile already exists.');
  }

  // Create the self-brand Competitor row; release the claim if it fails so
  // a retry can succeed.
  try {
    await putItem({
      PK: competitorPK(userId),
      SK: competitorSK(selfId),
      id: selfId,
      userId,
      name: body.companyName,
      url: body.companyWebsite,
      pagesToTrack: ['homepage'],
      status: 'active',
      targetKind: 'self',
      industry,
      createdAt: now,
      updatedAt: now,
      ...gsi2ActiveCompetitorKeys(selfId),
    });
  } catch (err) {
    await releaseSelfBrandSlot(userId).catch(() => {});
    throw err;
  }

  // Persist companyWebsite (+ companyName / industry if changed) on the User row.
  const userUpdates: Record<string, unknown> = {
    companyWebsite: body.companyWebsite,
    updatedAt: now,
  };
  if (!user.companyName) userUpdates.companyName = body.companyName;
  if (!user.industry && body.industry) userUpdates.industry = body.industry;
  await updateItem(userPK(userId), userSK(), userUpdates);

  // Kick off the first deep-research pass.
  let runId: string | undefined;
  if (process.env.RESEARCH_PIPELINE_ARN) {
    runId = generateId();
    const run = await createResearchRun({
      id: runId,
      tenantUserId: userId,
      competitorId: selfId,
      competitorName: body.companyName,
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
                competitorId: selfId,
                userId,
                tenantUserId: userId,
                runId,
                runStartedAt: run.startedAt,
                name: body.companyName,
                url: body.companyWebsite,
                industry,
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
        errorMessage:
          err instanceof Error ? err.message : 'Failed to start research pipeline',
      });
      logger.warn('brand_setup_pipeline_start_failed', {
        userId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    if (executionArn) {
      await markRunStarted(userId, run.startedAt, runId, executionArn);
    }
  }

  logger.info('brand_setup_completed', { userId, selfId });

  return {
    statusCode: 201,
    body: {
      data: {
        id: selfId,
        name: body.companyName,
        url: body.companyWebsite,
        industry,
        runId,
      },
    },
  };
});
