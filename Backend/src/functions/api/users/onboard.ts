import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { validate, onboardSchema } from '../../../shared/middleware/validation';
import { putItem, updateItem, queryGSI, queryByPK, getItem } from '../../../shared/db/queries';
import {
  userPK,
  userSK,
  competitorPK,
  competitorSK,
  gsi2ActiveCompetitorKeys,
  workspacePK,
  workspaceSK,
  membershipByUserPK,
  membershipByUserSK,
  memberByWorkspacePK,
  memberByWorkspaceSK,
} from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { PLAN_LIMITS, User } from '../../../shared/types';
import { enforceResearchEligibility } from '../../../shared/utils/research-eligibility';
import {
  createResearchRun,
  markRunFinished,
  markRunStarted,
} from '../../../shared/services/research-run';
import { logger } from '../../../shared/utils/logger';

const sfn = new SFNClient({});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(onboardSchema, parseBody(event));

  // Find user
  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  // Check plan limit
  const maxCompetitors = PLAN_LIMITS[user.plan].maxCompetitors;
  if (body.competitors.length > maxCompetitors) {
    throw new HttpError(
      403,
      'PLAN_LIMIT',
      `Your ${user.plan} plan allows up to ${maxCompetitors} competitors. You submitted ${body.competitors.length}.`
    );
  }

  // Misuse-defense gate: bulk pre-check ALL competitors before any DB writes.
  // If any single competitor fails, the whole onboard fails — better UX than
  // partial success. Counts each competitor against the user's daily quota.
  const eligibility = await enforceResearchEligibility({
    user,
    competitors: body.competitors.map((c) => ({ name: c.name, url: c.url })),
  });
  if (!eligibility.allowed) {
    const status = eligibility.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 403;
    throw new HttpError(
      status,
      eligibility.code ?? 'NOT_ALLOWED',
      eligibility.reason ?? 'One or more of your competitor entries is not allowed.'
    );
  }

  // Create competitor records
  const now = new Date().toISOString();
  const competitorIds: string[] = [];

  for (const comp of body.competitors) {
    const compId = generateId();
    competitorIds.push(compId);

    await putItem({
      PK: competitorPK(userId),
      SK: competitorSK(compId),
      id: compId,
      userId,
      name: comp.name,
      url: comp.url,
      pagesToTrack: comp.pagesToTrack,
      status: 'active',
      targetKind: 'competitor',
      createdAt: now,
      updatedAt: now,
      ...gsi2ActiveCompetitorKeys(compId),
    });
  }

  // Phase 23 — Brand Pulse. If the user provided their own company website,
  // also create the self-brand Competitor row so the same deep-research
  // pipeline monitors it on day 1. Idempotent for re-onboard: skip if a
  // self row already exists for this workspace.
  let selfBrandId: string | undefined;
  if (body.companyWebsite) {
    const { items: existingSelf } = await queryByPK(competitorPK(userId), 'COMP#');
    const hasExistingSelf = (existingSelf as Array<Record<string, unknown>>).some(
      (c) => c.targetKind === 'self'
    );
    if (!hasExistingSelf) {
      selfBrandId = generateId();
      await putItem({
        PK: competitorPK(userId),
        SK: competitorSK(selfBrandId),
        id: selfBrandId,
        userId,
        name: body.companyName,
        url: body.companyWebsite,
        pagesToTrack: ['homepage'],
        status: 'active',
        targetKind: 'self',
        industry: body.industry,
        createdAt: now,
        updatedAt: now,
        ...gsi2ActiveCompetitorKeys(selfBrandId),
      });
    }
  }

  // Phase 4a — bootstrap a default workspace + owner Membership for this
  // user. The workspace owner's userId becomes the tenant key for all of
  // the user's data (which stays under USER#<userId> as before). When the
  // user invites collaborators later, the invitee resolves to THIS userId
  // via the resolveTenantContext middleware. Idempotent: if the user
  // re-onboards (rare), the existing membership is detected and creation
  // is skipped.
  const { items: priorMembershipItems } = await queryByPK(
    membershipByUserPK(userId),
    'MEMBERSHIP#',
    { limit: 1 }
  );
  if (priorMembershipItems.length === 0) {
    const workspaceId = generateId();
    const workspaceName = `${body.companyName} workspace`;
    await putItem({
      PK: workspacePK(workspaceId),
      SK: workspaceSK(),
      id: workspaceId,
      name: workspaceName,
      ownerUserId: userId,
      // Phase 4c — immutable data-tenancy key. Stays put across ownership
      // transfers so existing competitor / change / subscription rows never
      // need re-keying.
      tenantUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
    // Membership written under both PKs for cheap lookup in either direction
    await putItem({
      PK: membershipByUserPK(userId),
      SK: membershipByUserSK(workspaceId),
      workspaceId,
      userId,
      role: 'owner',
      joinedAt: now,
      workspaceName,
    });
    await putItem({
      PK: memberByWorkspacePK(workspaceId),
      SK: memberByWorkspaceSK(userId),
      workspaceId,
      userId,
      role: 'owner',
      joinedAt: now,
      email,
    });
    logger.info('workspace_created_default', { userId, workspaceId, workspaceName });
  }

  // Mark onboarding complete + record consent versions for audit trail.
  // Consent captured here because this is the first User row write after
  // signup; signup itself only creates the Cognito user.
  const consentUpdates: Record<string, unknown> = {
    onboardingComplete: true,
    companyName: body.companyName,
    industry: body.industry,
    updatedAt: now,
  };
  if (body.companyWebsite) {
    consentUpdates.companyWebsite = body.companyWebsite;
  }
  if (body.tosVersion) {
    consentUpdates.tosVersion = body.tosVersion;
    consentUpdates.tosAcceptedAt = now;
  }
  if (body.privacyVersion) {
    consentUpdates.privacyVersion = body.privacyVersion;
    consentUpdates.privacyAcceptedAt = now;
  }
  await updateItem(userPK(userId), userSK(), consentUpdates);

  // Trigger initial deep research for each new competitor (Phase 22 also
  // creates a queued ResearchRun row per competitor before StartExecution
  // so the dashboard panel reflects in-flight runs).
  if (process.env.RESEARCH_PIPELINE_ARN) {
    // Phase 23 — append a self-brand research run when we created the self row.
    const allTargets: Array<{
      competitorId: string;
      name: string;
      url: string;
      targetKind: 'competitor' | 'self';
    }> = body.competitors.map((comp, i) => ({
      competitorId: competitorIds[i],
      name: comp.name,
      url: comp.url,
      targetKind: 'competitor' as const,
    }));
    if (selfBrandId && body.companyWebsite) {
      allTargets.push({
        competitorId: selfBrandId,
        name: body.companyName,
        url: body.companyWebsite,
        targetKind: 'self',
      });
    }

    const runs = await Promise.all(
      allTargets.map((t) =>
        createResearchRun({
          id: generateId(),
          tenantUserId: userId,
          competitorId: t.competitorId,
          competitorName: t.name,
          triggeredByUserId: userId,
          triggeredByEmail: email,
          triggerSource: 'onboarding',
        })
      )
    );

    const researchInput = allTargets.map((t, i) => ({
      competitorId: t.competitorId,
      userId,
      tenantUserId: userId,
      runId: runs[i].id,
      runStartedAt: runs[i].startedAt,
      name: t.name,
      url: t.url,
      industry: body.industry,
      targetKind: t.targetKind,
    }));

    let executionArn: string | undefined;
    try {
      const result = await sfn.send(
        new StartExecutionCommand({
          stateMachineArn: process.env.RESEARCH_PIPELINE_ARN,
          input: JSON.stringify({ competitors: researchInput }),
        })
      );
      executionArn = result.executionArn;
    } catch (err) {
      // SFN failure leaves all rows stuck in queued — finalise them as failed
      // so onboarding still succeeds (the user just sees failed runs they can
      // retry via Research Now).
      await Promise.all(
        runs.map((run) =>
          markRunFinished(userId, run.startedAt, run.id, {
            status: 'failed',
            errorMessage:
              err instanceof Error ? err.message : 'Failed to start research pipeline',
          })
        )
      );
      logger.warn('onboarding_pipeline_start_failed', {
        userId,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    if (executionArn) {
      await Promise.all(
        runs.map((run) => markRunStarted(userId, run.startedAt, run.id, executionArn!))
      );
    }
  }

  logger.info('onboarding_completed', {
    userId,
    competitorCount: body.competitors.length,
    industry: body.industry,
  });

  return {
    statusCode: 200,
    body: {
      data: {
        message: 'Onboarding complete. Initial research started.',
        competitorIds,
      },
    },
  };
});
