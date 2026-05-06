/**
 * PATCH /workspaces/current
 *
 * Phase 4b — owner-only workspace rename. Updates the Workspace PROFILE row
 * AND propagates the new name to every Membership/Member row's denormalized
 * `workspaceName` field so the sidebar in other tabs picks it up.
 */

import { z } from 'zod';
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
import { getItem, queryByPK, updateItem } from '../../../shared/db/queries';
import {
  workspacePK,
  workspaceSK,
  memberByWorkspacePK,
  memberByWorkspaceSKPrefix,
  membershipByUserPK,
  membershipByUserSK,
} from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { recordAuditEvent } from '../../../shared/services/audit';
import { logger } from '../../../shared/utils/logger';
import type { Workspace } from '../../../shared/types';

const updateSchema = z.object({
  name: z.string().min(1).max(80).trim(),
});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(updateSchema, parseBody(event));

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  assertOwner(ctx, 'workspace settings');

  const workspace = await getItem<Workspace>(workspacePK(ctx.workspaceId), workspaceSK());
  if (!workspace) throw new HttpError(404, 'NOT_FOUND', 'Workspace not found');

  const oldName = workspace.name;
  if (oldName === body.name) {
    return { statusCode: 200, body: { data: { workspaceId: ctx.workspaceId, name: body.name } } };
  }

  const now = new Date().toISOString();

  // 1. Update the Workspace PROFILE row.
  await updateItem(workspacePK(ctx.workspaceId), workspaceSK(), {
    name: body.name,
    updatedAt: now,
  });

  // 2. Propagate to every Member + Membership denormalized name. Best-effort
  // — a partial failure leaves the sidebar showing the old name in stale
  // tabs until the user reloads. Acceptable; the source-of-truth Workspace
  // row is correct.
  const { items: members } = await queryByPK(
    memberByWorkspacePK(ctx.workspaceId),
    memberByWorkspaceSKPrefix()
  );
  await Promise.all(
    members.flatMap((m) => {
      const memberUserId = m.userId as string;
      return [
        updateItem(memberByWorkspacePK(ctx.workspaceId), m.SK as string, {
          workspaceName: body.name,
        }).catch((err) =>
          logger.warn('member_row_rename_failed', {
            workspaceId: ctx.workspaceId,
            memberUserId,
            err: err instanceof Error ? err.message : String(err),
          })
        ),
        updateItem(membershipByUserPK(memberUserId), membershipByUserSK(ctx.workspaceId), {
          workspaceName: body.name,
        }).catch((err) =>
          logger.warn('membership_row_rename_failed', {
            workspaceId: ctx.workspaceId,
            memberUserId,
            err: err instanceof Error ? err.message : String(err),
          })
        ),
      ];
    })
  );

  await recordAuditEvent({
    ctx,
    action: 'workspace.renamed',
    resourceId: ctx.workspaceId,
    resourceLabel: body.name,
    meta: { oldName, newName: body.name },
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  logger.info('workspace_renamed', {
    workspaceId: ctx.workspaceId,
    oldName,
    newName: body.name,
    by: ctx.callerUserId,
  });

  return {
    statusCode: 200,
    body: { data: { workspaceId: ctx.workspaceId, name: body.name } },
  };
});
