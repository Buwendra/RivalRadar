/**
 * GET /workspaces/current/api-keys
 *
 * Phase 11 — owner-only list of the workspace's API keys. Strips `keyHash`
 * before return; only the 4-char hint is exposed for UI rendering.
 */

import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
  assertOwner,
} from '../../../shared/middleware/tenant';
import { queryByPK } from '../../../shared/db/queries';
import {
  apiKeyByWorkspacePK,
  apiKeyByWorkspaceSKPrefix,
} from '../../../shared/db/keys';
import type { ApiKey } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  assertOwner(ctx, 'API keys');

  const { items } = await queryByPK(
    apiKeyByWorkspacePK(ctx.workspaceId),
    apiKeyByWorkspaceSKPrefix()
  );

  const keys = (items as unknown as ApiKey[]).map((k) => ({
    id: k.id,
    name: k.name,
    keyHint: k.keyHint,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    disabled: k.disabled,
  }));

  return {
    statusCode: 200,
    body: { data: keys },
  };
});
