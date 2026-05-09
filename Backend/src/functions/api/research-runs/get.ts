/**
 * GET /research-runs/{id}
 *
 * Phase 22 — return a single ResearchRun with its full event log. Loaded
 * lazily by the UI when a row is expanded. The SK is composite
 * (`RUN#<startedAt>#<id>`), so we paginate the workspace's runs and find
 * by id — bounded to the 50 most-recent entries since the row's TTL is
 * 90 days and onboarding bursts are <= 25.
 */

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
import type { ResearchRun } from '../../../shared/types';

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

  return {
    statusCode: 200,
    body: {
      data: {
        id: row.id,
        competitorId: row.competitorId,
        competitorName: row.competitorName,
        triggeredByUserId: row.triggeredByUserId,
        triggeredByEmail: row.triggeredByEmail,
        triggerSource: row.triggerSource,
        status: row.status,
        executionArn: row.executionArn,
        startedAt: row.startedAt,
        runStartedAt: row.runStartedAt,
        finishedAt: row.finishedAt,
        deltaCount: row.deltaCount,
        citationCount: row.citationCount,
        errorMessage: row.errorMessage,
        events: row.events ?? [],
      },
    },
  };
});
