/**
 * API key auth middleware (Phase 11).
 *
 * Builds a synthetic TenantContext from an X-API-Key header for the public
 * read API. Three-line lifecycle:
 *
 *   1. resolveApiKeyContext(event) — auth + minute throttle, returns ctx.
 *   2. assertApiAccess(ctx) — tier gate (Strategist+).
 *   3. Handler runs the same DynamoDB queries as authenticated routes.
 *
 * Per-key throttle: 60 req/min default. Counter lives on the auth-lookup
 * row (PK=APIKEY#<hash>); we increment-or-reset in a single updateItem
 * call. Race conditions allow a small (~5%) burst overshoot, which sits
 * comfortably below the WAF + APIGW stage caps already in place.
 */

import { createHash } from 'crypto';
import { getItem, updateItem } from '../db/queries';
import {
  apiKeyByHashPK,
  apiKeyByHashSK,
  userPK,
  userSK,
} from '../db/keys';
import { hasCapability } from '../utils/capability';
import { logger } from '../utils/logger';
import { HttpError } from './handler';
import type { PublicEvent } from './handler';
import type { TenantContext } from './tenant';
import type { ApiKey, User } from '../types';

export async function resolveApiKeyContext(
  event: PublicEvent,
  options?: { requireScope?: 'write' }
): Promise<TenantContext> {
  const headers = event.headers as Record<string, string | undefined>;
  const rawKey = headers['x-api-key'];
  if (!rawKey) {
    throw new HttpError(401, 'MISSING_API_KEY', 'X-API-Key header is required');
  }

  const hash = createHash('sha256').update(rawKey).digest('hex');
  const keyRow = await getItem<ApiKey>(apiKeyByHashPK(hash), apiKeyByHashSK());
  if (!keyRow || keyRow.disabled) {
    throw new HttpError(401, 'INVALID_API_KEY', 'API key is invalid or revoked');
  }

  // Phase 13 — scope gate. Pre-Phase-13 rows have no `scope`; default to
  // 'read' so existing keys can never accidentally gain write power.
  const effectiveScope = keyRow.scope ?? 'read';
  if (options?.requireScope === 'write' && effectiveScope !== 'write') {
    throw new HttpError(
      403,
      'WRITE_SCOPE_REQUIRED',
      'This API key is read-only. Mint a write key in workspace settings.'
    );
  }

  // Minute throttle: opportunistic increment-or-reset. Rows created before
  // the quota field existed get the same default the create route uses —
  // `nextCount > undefined` is always false, i.e. no throttle at all.
  const quotaPerMinute = keyRow.quotaPerMinute ?? 60;
  const now = Date.now();
  const windowResetAt = keyRow.windowResetAt ?? 0;
  const isNewWindow = now >= windowResetAt;
  const nextCount = isNewWindow ? 1 : (keyRow.requestCount ?? 0) + 1;

  if (!isNewWindow && nextCount > quotaPerMinute) {
    const retryAfterSec = Math.max(0, Math.ceil((windowResetAt - now) / 1000));
    throw new HttpError(
      429,
      'RATE_LIMITED',
      `API key exceeds ${quotaPerMinute} req/min. Retry after ${retryAfterSec}s.`
    );
  }

  // Best-effort write — never block the response
  void updateItem(apiKeyByHashPK(hash), apiKeyByHashSK(), {
    requestCount: nextCount,
    windowResetAt: isNewWindow ? now + 60_000 : windowResetAt,
    lastUsedAt: new Date(now).toISOString(),
  }).catch((err) =>
    logger.warn('api_key_throttle_write_failed', {
      err: err instanceof Error ? err.message : String(err),
    })
  );

  // Synthetic TenantContext. Role 'owner' because v1 is read-only and
  // there's no granular RBAC story for keys yet.
  return {
    tenantUserId: keyRow.tenantUserId,
    callerUserId: keyRow.createdByUserId,
    callerEmail: '(api-key)',
    workspaceId: keyRow.workspaceId,
    workspaceName: '(api-key)',
    role: 'owner',
  };
}

/**
 * Tier gate: re-checks the workspace owner's plan on every request, so a
 * downgrade silently disables existing keys. Throws 403 PLAN_REQUIRED when
 * the workspace tenant is on Scout or has no plan field.
 */
export async function assertApiAccess(ctx: TenantContext): Promise<void> {
  const owner = await getItem<User & Record<string, unknown>>(
    userPK(ctx.tenantUserId),
    userSK()
  );
  if (!hasCapability(owner ?? undefined, 'apiAccess')) {
    throw new HttpError(
      403,
      'PLAN_REQUIRED',
      'API access requires the Strategist plan or higher.'
    );
  }
}
