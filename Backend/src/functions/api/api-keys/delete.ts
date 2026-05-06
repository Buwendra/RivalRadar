/**
 * DELETE /workspaces/current/api-keys/{id}
 *
 * Phase 11 — owner-only revoke. Idempotent — returns 200 even if the key
 * was already revoked. Deletes BOTH rows of the double-write so the
 * X-API-Key auth path also stops accepting it.
 */

import {
  apiHandler,
  getUserEmail,
  HttpError,
  getSourceIp,
  getUserAgent,
} from '../../../shared/middleware/handler';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
  assertOwner,
} from '../../../shared/middleware/tenant';
import { deleteItem, getItem } from '../../../shared/db/queries';
import {
  apiKeyByHashPK,
  apiKeyByHashSK,
  apiKeyByWorkspacePK,
  apiKeyByWorkspaceSK,
} from '../../../shared/db/keys';
import { recordAuditEvent } from '../../../shared/services/audit';
import { logger } from '../../../shared/utils/logger';
import type { ApiKey } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const id = event.pathParameters?.id;
  if (!id) throw new HttpError(400, 'MISSING_ID', 'API key id is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  assertOwner(ctx, 'API keys');

  // Read the workspace mirror to recover the keyHash for the auth-lookup row.
  const mirror = await getItem<ApiKey>(
    apiKeyByWorkspacePK(ctx.workspaceId),
    apiKeyByWorkspaceSK(id)
  );

  if (mirror) {
    await Promise.all([
      deleteItem(apiKeyByWorkspacePK(ctx.workspaceId), apiKeyByWorkspaceSK(id)),
      deleteItem(apiKeyByHashPK(mirror.keyHash), apiKeyByHashSK()),
    ]);
  }

  await recordAuditEvent({
    ctx,
    action: 'api_key.revoked',
    resourceId: id,
    resourceLabel: mirror?.name,
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  logger.info('api_key_revoked', {
    workspaceId: ctx.workspaceId,
    keyId: id,
    by: ctx.callerUserId,
  });

  return {
    statusCode: 200,
    body: { data: { id, revoked: true } },
  };
});
