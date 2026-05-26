/**
 * AuditEvent writer (Phase 4b).
 *
 * Fire-and-forget: a write failure must not roll back the user's action.
 * Callers should `void recordAuditEvent(...)` (or `await` and discard) at
 * the end of a successful mutation handler.
 */

import { generateId } from '../utils/id';
import { putItem } from '../db/queries';
import { auditEventPK, auditEventSK, authAuditPK, authAuditSK } from '../db/keys';
import { logger } from '../utils/logger';
import type { AuditAction, AuditEvent } from '../types';
import type { TenantContext } from '../middleware/tenant';

const TTL_DAYS = 90;

type AuthAuditAction = Extract<AuditAction, `auth.${string}`>;

export interface RecordAuditInput {
  ctx: TenantContext;
  action: AuditAction;
  resourceId?: string;
  resourceLabel?: string;
  meta?: Record<string, string | number | boolean>;
  sourceIp?: string;
  userAgent?: string;
}

export async function recordAuditEvent(input: RecordAuditInput): Promise<void> {
  const id = generateId();
  const now = new Date();
  const event: AuditEvent = {
    id,
    workspaceId: input.ctx.workspaceId,
    actorUserId: input.ctx.callerUserId,
    actorEmail: input.ctx.callerEmail,
    action: input.action,
    ...(input.resourceId !== undefined ? { resourceId: input.resourceId } : {}),
    ...(input.resourceLabel !== undefined ? { resourceLabel: input.resourceLabel } : {}),
    ...(input.meta !== undefined ? { meta: input.meta } : {}),
    ...(input.sourceIp !== undefined ? { sourceIp: input.sourceIp } : {}),
    ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
    createdAt: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + TTL_DAYS * 24 * 60 * 60,
  };
  try {
    await putItem({
      PK: auditEventPK(input.ctx.workspaceId),
      SK: auditEventSK(event.createdAt, id),
      ...event,
    });
  } catch (err) {
    logger.warn('audit_event_write_failed', {
      action: input.action,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface RecordAuthAuditInput {
  action: AuthAuditAction;
  email?: string;
  userId?: string;
  sourceIp?: string;
  userAgent?: string;
  meta?: Record<string, string | number | boolean>;
}

/**
 * Auth-flow audit writer (Phase 9 final wave). Signin/signup events happen
 * outside any workspace context, so they cannot use `recordAuditEvent`.
 * Rows go to `AUTH_AUDIT#<YYYY-MM>` for cheap monthly forensic scans and
 * inherit the 90-day TTL — long-term retention lives in CloudTrail.
 *
 * Fire-and-forget: a write failure must never block the auth path.
 */
export async function recordAuthAuditEvent(input: RecordAuthAuditInput): Promise<void> {
  const id = generateId();
  const now = new Date();
  const createdAt = now.toISOString();
  const yyyymm = createdAt.slice(0, 7);
  try {
    await putItem({
      PK: authAuditPK(yyyymm),
      SK: authAuditSK(createdAt, id),
      id,
      action: input.action,
      ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.sourceIp !== undefined ? { sourceIp: input.sourceIp } : {}),
      ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
      ...(input.meta !== undefined ? { meta: input.meta } : {}),
      createdAt,
      expiresAt: Math.floor(now.getTime() / 1000) + TTL_DAYS * 24 * 60 * 60,
    });
  } catch (err) {
    logger.warn('auth_audit_event_write_failed', {
      action: input.action,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
