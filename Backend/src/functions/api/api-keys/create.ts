/**
 * POST /workspaces/current/api-keys
 *
 * Phase 11 — owner-only. Mints a new public API key for the workspace.
 * Plaintext is returned ONCE in the response; only sha256(plaintext)
 * persists. Tier-gated: Scout cannot create keys, Strategist up to 5,
 * Command up to 25.
 */

import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import {
  apiHandler,
  getUserEmail,
  parseBody,
  HttpError,
  getSourceIp,
  getUserAgent,
} from '../../../shared/middleware/handler';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
  assertOwner,
} from '../../../shared/middleware/tenant';
import { getItem, putItem, queryByPK } from '../../../shared/db/queries';
import {
  apiKeyByHashPK,
  apiKeyByHashSK,
  apiKeyByWorkspacePK,
  apiKeyByWorkspaceSK,
  apiKeyByWorkspaceSKPrefix,
  userPK,
  userSK,
  workspacePK,
  workspaceSK,
} from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { generateId } from '../../../shared/utils/id';
import { capabilitiesFor } from '../../../shared/utils/capability';
import { recordAuditEvent } from '../../../shared/services/audit';
import { logger } from '../../../shared/utils/logger';
import type { ApiKey, User, Workspace } from '../../../shared/types';

const DEFAULT_QUOTA_PER_MINUTE = 60;

const createSchema = z.object({
  name: z.string().min(1).max(80).trim(),
});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(createSchema, parseBody(event));

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  assertOwner(ctx, 'API keys');

  // Tier gate against the workspace owner's plan.
  const owner = await getItem<User & Record<string, unknown>>(
    userPK(ctx.tenantUserId),
    userSK()
  );
  const caps = capabilitiesFor(owner ?? undefined);
  if (!caps.apiAccess) {
    throw new HttpError(
      403,
      'PLAN_REQUIRED',
      'API access requires the Strategist plan or higher.'
    );
  }

  // Cap check
  const { items: existing } = await queryByPK(
    apiKeyByWorkspacePK(ctx.workspaceId),
    apiKeyByWorkspaceSKPrefix()
  );
  if (caps.apiKeys.max > 0 && existing.length >= caps.apiKeys.max) {
    throw new HttpError(
      403,
      'PLAN_LIMIT',
      `Your plan allows up to ${caps.apiKeys.max} API keys. Revoke one or upgrade to add more.`
    );
  }

  // Resolve workspace's tenantUserId once (lazy backfill from ownerUserId
  // if pre-Phase-4c row).
  const workspace = await getItem<Workspace>(workspacePK(ctx.workspaceId), workspaceSK());
  const tenantUserId = workspace?.tenantUserId ?? ctx.tenantUserId;

  // Generate plaintext + hash + hint
  const plaintext = `rsk_live_${randomBytes(32).toString('hex')}`;
  const keyHash = createHash('sha256').update(plaintext).digest('hex');
  const keyHint = plaintext.slice(-4);

  const id = generateId();
  const now = new Date().toISOString();
  const row: ApiKey = {
    id,
    workspaceId: ctx.workspaceId,
    tenantUserId,
    name: body.name,
    keyHash,
    keyHint,
    createdByUserId: ctx.callerUserId,
    createdAt: now,
    quotaPerMinute: DEFAULT_QUOTA_PER_MINUTE,
  };

  // Double-write: auth-lookup row + workspace mirror in parallel.
  await Promise.all([
    putItem({
      PK: apiKeyByHashPK(keyHash),
      SK: apiKeyByHashSK(),
      ...row,
    }),
    putItem({
      PK: apiKeyByWorkspacePK(ctx.workspaceId),
      SK: apiKeyByWorkspaceSK(id),
      ...row,
    }),
  ]);

  await recordAuditEvent({
    ctx,
    action: 'api_key.created',
    resourceId: id,
    resourceLabel: body.name,
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  // SECURITY: never log plaintext or hash.
  logger.info('api_key_created', {
    workspaceId: ctx.workspaceId,
    keyId: id,
    by: ctx.callerUserId,
  });

  return {
    statusCode: 201,
    body: {
      data: {
        id,
        name: body.name,
        keyHint,
        // Plaintext returned ONCE — UI must surface a copy-now banner.
        plaintext,
        createdAt: now,
      },
    },
  };
});
