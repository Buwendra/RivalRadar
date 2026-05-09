/**
 * GET /research-runs
 *
 * Phase 22 — list the workspace's research runs (newest first). Optional
 * `?competitorId=` and `?status=running` filters. Each row's events array
 * is truncated to the last 5 entries — full history via the single-row
 * endpoint.
 */

import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import {
  researchRunPK,
  researchRunSKPrefix,
} from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { ResearchRun, ResearchRunStatus } from '../../../shared/types';

const VALID_STATUSES: ResearchRunStatus[] = [
  'queued',
  'running',
  'succeeded',
  'failed',
];

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  const competitorIdFilter = event.queryStringParameters?.competitorId;
  const statusParam = event.queryStringParameters?.status as ResearchRunStatus | undefined;
  const statusFilter = statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : undefined;

  const { items } = await queryByPK(
    researchRunPK(ctx.tenantUserId),
    researchRunSKPrefix(),
    { scanForward: false, limit: 50 }
  );

  const rows = (items as unknown as ResearchRun[])
    .filter((r) => !competitorIdFilter || r.competitorId === competitorIdFilter)
    .filter((r) => !statusFilter || r.status === statusFilter)
    .map((r) => ({
      id: r.id,
      competitorId: r.competitorId,
      competitorName: r.competitorName,
      triggeredByUserId: r.triggeredByUserId,
      triggeredByEmail: r.triggeredByEmail,
      triggerSource: r.triggerSource,
      status: r.status,
      startedAt: r.startedAt,
      runStartedAt: r.runStartedAt,
      finishedAt: r.finishedAt,
      deltaCount: r.deltaCount,
      citationCount: r.citationCount,
      errorMessage: r.errorMessage,
      events: (r.events ?? []).slice(-5),
      hasMoreEvents: (r.events ?? []).length > 5,
    }));

  return {
    statusCode: 200,
    body: { data: rows },
  };
});
