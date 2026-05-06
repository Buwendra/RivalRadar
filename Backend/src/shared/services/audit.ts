/**
 * AuditEvent writer (Phase 4b).
 *
 * Fire-and-forget: a write failure must not roll back the user's action.
 * Callers should `void recordAuditEvent(...)` (or `await` and discard) at
 * the end of a successful mutation handler.
 */

import { generateId } from '../utils/id';
import { putItem } from '../db/queries';
import { auditEventPK, auditEventSK } from '../db/keys';
import { logger } from '../utils/logger';
import type { AuditAction, AuditEvent } from '../types';
import type { TenantContext } from '../middleware/tenant';

const TTL_DAYS = 90;

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
