/**
 * DELETE /workspaces/current
 *
 * Phase 4b — owner-only workspace deletion. Cascades: deletes the Workspace
 * PROFILE row + every Member/Membership row + every pending invitation.
 *
 * Crucially, does NOT delete the underlying USER#<id>-keyed data
 * (Competitors, Changes, Subscriptions, Integrations). The owner's data
 * persists, accessible via the resolver's legacy "self-as-tenant" fallback.
 * Members lose access on their next request — the resolver finds no
 * Membership row for them and falls back to their personal workspace.
 *
 * "Delete workspace" = "dissolve the team", not "delete the data".
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
import { deleteItem, getItem, queryByPK } from '../../../shared/db/queries';
import {
  workspacePK,
  workspaceSK,
  memberByWorkspacePK,
  memberByWorkspaceSKPrefix,
  membershipByUserPK,
  membershipByUserSK,
} from '../../../shared/db/keys';
import { recordAuditEvent } from '../../../shared/services/audit';
import { logger } from '../../../shared/utils/logger';
import type { Workspace } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  assertOwner(ctx, 'workspace settings');

  const workspace = await getItem<Workspace>(workspacePK(ctx.workspaceId), workspaceSK());
  if (!workspace) throw new HttpError(404, 'NOT_FOUND', 'Workspace not found');

  // Audit BEFORE the cascade — the audit row's PK uses the workspaceId
  // which still pins it (the audit row keeps existing under WORKSPACE#<id>
  // until its TTL expires).
  await recordAuditEvent({
    ctx,
    action: 'workspace.deleted',
    resourceId: ctx.workspaceId,
    resourceLabel: workspace.name,
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  // Collect all rows that need cascading delete: members + their
  // membership reverse-direction rows.
  const { items: members } = await queryByPK(
    memberByWorkspacePK(ctx.workspaceId),
    memberByWorkspaceSKPrefix()
  );

  // Best-effort parallel delete. Partial failure is recoverable — re-running
  // delete is idempotent (deleteItem on a missing row is a no-op).
  await Promise.all(
    members.flatMap((m) => {
      const memberUserId = m.userId as string;
      return [
        deleteItem(memberByWorkspacePK(ctx.workspaceId), m.SK as string),
        deleteItem(membershipByUserPK(memberUserId), membershipByUserSK(ctx.workspaceId)),
      ];
    })
  );

  // Delete the Workspace PROFILE row last.
  await deleteItem(workspacePK(ctx.workspaceId), workspaceSK());

  logger.info('workspace_deleted', {
    workspaceId: ctx.workspaceId,
    workspaceName: workspace.name,
    memberCount: members.length,
    by: ctx.callerUserId,
  });

  return {
    statusCode: 200,
    body: { data: { workspaceId: ctx.workspaceId, deleted: true } },
  };
});
