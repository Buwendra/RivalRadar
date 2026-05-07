/**
 * GET /battlecards
 *
 * Phase 20 — list the workspace's battlecards, newest first. Optional
 * `?competitorId=` filter restricts to one competitor's history. The
 * share URL is composed against the request's API Gateway host so a
 * single deployment works for dev/staging/prod without env-var per-stage.
 */

import {
  apiHandler,
  getUserEmail,
} from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import {
  battlecardPK,
  battlecardSKPrefix,
} from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { Battlecard } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  const competitorIdFilter = event.queryStringParameters?.competitorId;

  const { items } = await queryByPK(
    battlecardPK(ctx.tenantUserId),
    battlecardSKPrefix(),
    { scanForward: false, limit: 50 }
  );

  const apiHost =
    event.requestContext.domainName ?? process.env.API_PUBLIC_HOST ?? '';
  const buildShareUrl = (token: string) =>
    apiHost
      ? `https://${apiHost}/public/battlecards/${token}`
      : `/public/battlecards/${token}`;

  const rows = (items as unknown as Battlecard[])
    .filter((b) => !competitorIdFilter || b.competitorId === competitorIdFilter)
    .map((b) => ({
      id: b.id,
      competitorId: b.competitorId,
      competitorName: b.competitorName,
      publicToken: b.publicToken,
      shareUrl: buildShareUrl(b.publicToken),
      filename: b.filename,
      pdfBytes: b.pdfBytes,
      expiresAt: b.expiresAt,
      createdAt: b.createdAt,
      revokedAt: b.revokedAt,
    }));

  return {
    statusCode: 200,
    body: { data: rows },
  };
});
