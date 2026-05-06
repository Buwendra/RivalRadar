/**
 * GET /workspaces/current/members
 * DELETE /workspaces/current/members/{userId}
 *
 * Phase 4a — list the current workspace's members + remove one (owner only).
 * Single dispatcher handler routes by event.requestContext.http.method.
 *
 * "current" = the workspace resolved by `resolveTenantContext` from the
 * caller's email + X-Workspace-Id header. Owner cannot remove themselves
 * (would orphan the workspace) — must transfer ownership first (a feature
 * deferred to Phase 4b).
 */

import {
  apiHandler,
  getUserEmail,
  HttpError,
  getSourceIp,
  getUserAgent,
} from '../../../shared/middleware/handler';
import { resolveTenantContext, getRequestedWorkspaceId } from '../../../shared/middleware/tenant';
import { queryByPK, deleteItem } from '../../../shared/db/queries';
import {
  memberByWorkspacePK,
  memberByWorkspaceSK,
  memberByWorkspaceSKPrefix,
  membershipByUserPK,
  membershipByUserSK,
} from '../../../shared/db/keys';
import { logger } from '../../../shared/utils/logger';
import { recordAuditEvent } from '../../../shared/services/audit';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const requestedWsId = getRequestedWorkspaceId(event.headers as Record<string, string | undefined>);
  const ctx = await resolveTenantContext(email, requestedWsId);

  const method = event.requestContext.http.method;

  if (method === 'GET') {
    const { items } = await queryByPK(
      memberByWorkspacePK(ctx.workspaceId),
      memberByWorkspaceSKPrefix()
    );
    return {
      statusCode: 200,
      body: {
        data: items.map((m) => ({
          userId: m.userId as string,
          email: m.email as string | undefined,
          role: m.role as string,
          joinedAt: m.joinedAt as string,
          isYou: (m.userId as string) === ctx.callerUserId,
        })),
      },
    };
  }

  // DELETE — owner only, can't remove self
  if (method === 'DELETE') {
    if (ctx.role !== 'owner') {
      throw new HttpError(403, 'FORBIDDEN', 'Only the workspace owner can remove members.');
    }
    const targetUserId = event.pathParameters?.userId;
    if (!targetUserId) throw new HttpError(400, 'MISSING_ID', 'User id is required');
    if (targetUserId === ctx.callerUserId) {
      throw new HttpError(
        409,
        'CANNOT_REMOVE_SELF',
        'You cannot remove yourself. Transfer ownership first (coming soon).'
      );
    }

    // Delete from BOTH directions of the membership index
    await Promise.all([
      deleteItem(memberByWorkspacePK(ctx.workspaceId), memberByWorkspaceSK(targetUserId)),
      deleteItem(membershipByUserPK(targetUserId), membershipByUserSK(ctx.workspaceId)),
    ]);

    logger.info('workspace_member_removed', {
      workspaceId: ctx.workspaceId,
      removedUserId: targetUserId,
      removedBy: ctx.callerUserId,
    });

    await recordAuditEvent({
      ctx,
      action: 'workspace.member_removed',
      resourceId: targetUserId,
      sourceIp: getSourceIp(event),
      userAgent: getUserAgent(event),
    });

    return {
      statusCode: 200,
      body: { data: { removed: true, userId: targetUserId } },
    };
  }

  throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Unsupported method');
});
