/**
 * GET /workspaces/current/audit
 *
 * Phase 4b — list recent audit events for the current workspace. Owner-only.
 * Newest-first, cursor-paginated, default page size 50.
 */

import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
  assertOwner,
} from '../../../shared/middleware/tenant';
import { queryByPK } from '../../../shared/db/queries';
import { auditEventPK, auditEventSKPrefix } from '../../../shared/db/keys';
import { validate, paginationSchema } from '../../../shared/middleware/validation';
import type { AuditEvent } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const params = validate(paginationSchema, event.queryStringParameters ?? {});

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  assertOwner(ctx, 'the audit log');

  const { items, cursor } = await queryByPK(
    auditEventPK(ctx.workspaceId),
    auditEventSKPrefix(),
    {
      limit: params.limit ?? 50,
      cursor: params.cursor,
      scanForward: false,
    }
  );

  const events = (items as unknown as AuditEvent[]).map((e) => ({
    id: e.id,
    actorUserId: e.actorUserId,
    actorEmail: e.actorEmail,
    action: e.action,
    resourceId: e.resourceId,
    resourceLabel: e.resourceLabel,
    meta: e.meta,
    sourceIp: e.sourceIp,
    userAgent: e.userAgent,
    createdAt: e.createdAt,
  }));

  return {
    statusCode: 200,
    body: {
      data: events,
      meta: { cursor, hasMore: !!cursor },
    },
  };
});
