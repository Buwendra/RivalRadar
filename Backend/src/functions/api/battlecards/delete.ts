/**
 * DELETE /battlecards/{id}
 *
 * Phase 20 — soft-revoke a battlecard. The DDB row + S3 object stay until
 * the row's TTL elapses; the public endpoint returns 410 GONE if the
 * `revokedAt` marker is set. Used for "the link leaked, kill it" flows.
 */

import {
  apiHandler,
  getUserEmail,
  HttpError,
} from '../../../shared/middleware/handler';
import { queryByPK, updateItem } from '../../../shared/db/queries';
import {
  battlecardPK,
  battlecardSKPrefix,
} from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { logger } from '../../../shared/utils/logger';
import type { Battlecard } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const id = event.pathParameters?.id;
  if (!id) throw new HttpError(400, 'MISSING_ID', 'Battlecard ID is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  // Look up the battlecard's SK (composite, double-segment) by scanning the
  // tenant's battlecard rows. Bounded to 50 rows by Phase 20 design.
  const { items } = await queryByPK(
    battlecardPK(ctx.tenantUserId),
    battlecardSKPrefix(),
    { scanForward: false, limit: 50 }
  );
  const row = (items as unknown as Battlecard[]).find((b) => b.id === id);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Battlecard not found');

  if (row.revokedAt) {
    return {
      statusCode: 200,
      body: { data: { id, revokedAt: row.revokedAt, alreadyRevoked: true } },
    };
  }

  const now = new Date().toISOString();
  await updateItem(
    battlecardPK(ctx.tenantUserId),
    `BATTLECARD#${row.createdAt}#${id}`,
    { revokedAt: now }
  );

  logger.info('battlecard_revoked', {
    battlecardId: id,
    competitorId: row.competitorId,
    tenantUserId: ctx.tenantUserId,
    callerUserId: ctx.callerUserId,
  });

  return {
    statusCode: 200,
    body: { data: { id, revokedAt: now } },
  };
});
