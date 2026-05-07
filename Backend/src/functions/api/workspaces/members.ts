/**
 * GET /workspaces/current/members
 * DELETE /workspaces/current/members/{userId}
 * PATCH /workspaces/current/members/{userId}        (Phase 14 — role change)
 *
 * Phase 4a — list + remove. Phase 14 adds role change between member/admin.
 * Single dispatcher handler routes by event.requestContext.http.method.
 *
 * Gating:
 *   GET     — any member of the workspace.
 *   DELETE  — admin or owner. Cannot remove the workspace owner; cannot
 *             remove self.
 *   PATCH   — owner only (admins do not change roles to prevent the
 *             second-owner-attack vector). Cannot demote the owner; cannot
 *             change own role.
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
  assertAdminOrOwner,
} from '../../../shared/middleware/tenant';
import { getItem, queryByPK, deleteItem, updateItem } from '../../../shared/db/queries';
import {
  memberByWorkspacePK,
  memberByWorkspaceSK,
  memberByWorkspaceSKPrefix,
  membershipByUserPK,
  membershipByUserSK,
} from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import { recordAuditEvent } from '../../../shared/services/audit';
import { enqueueNotification } from '../../../shared/services/notifications';
import type { MembershipRole } from '../../../shared/types';

const roleChangeSchema = z.object({
  role: z.enum(['member', 'admin']),
});

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

  // DELETE — Phase 14: admin OR owner; can't remove owner or self.
  if (method === 'DELETE') {
    assertAdminOrOwner(ctx, 'workspace members');
    const targetUserId = event.pathParameters?.userId;
    if (!targetUserId) throw new HttpError(400, 'MISSING_ID', 'User id is required');
    if (targetUserId === ctx.callerUserId) {
      throw new HttpError(
        409,
        'CANNOT_REMOVE_SELF',
        'You cannot remove yourself. Transfer ownership first if you are the owner.'
      );
    }

    // Phase 14 — owner protection. Lookup the target's role; reject if owner.
    // Cheap: a single GET on the workspace mirror row.
    const targetRow = await getItem<{ role?: MembershipRole; email?: string }>(
      memberByWorkspacePK(ctx.workspaceId),
      memberByWorkspaceSK(targetUserId)
    );
    if (targetRow?.role === 'owner') {
      throw new HttpError(
        409,
        'CANNOT_REMOVE_OWNER',
        'The workspace owner cannot be removed. Transfer ownership first.'
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
      resourceLabel: targetRow?.email,
      sourceIp: getSourceIp(event),
      userAgent: getUserAgent(event),
    });

    // Phase 18 — notify the kicked user.
    void enqueueNotification({
      recipientUserId: targetUserId,
      kind: 'workspace.member_removed',
      title: `Removed from ${ctx.workspaceName}`,
      body: `${ctx.callerEmail} removed you from the workspace.`,
      href: '/dashboard',
      meta: {
        workspaceId: ctx.workspaceId,
        removedByEmail: ctx.callerEmail,
      },
    });

    return {
      statusCode: 200,
      body: { data: { removed: true, userId: targetUserId } },
    };
  }

  // PATCH — Phase 14: change a member's role between 'member' and 'admin'.
  // Owner-only. Cannot target the owner; cannot change own role.
  if (method === 'PATCH') {
    assertOwner(ctx, 'member roles');
    const targetUserId = event.pathParameters?.userId;
    if (!targetUserId) throw new HttpError(400, 'MISSING_ID', 'User id is required');
    if (targetUserId === ctx.callerUserId) {
      throw new HttpError(
        409,
        'CANNOT_CHANGE_SELF',
        'You cannot change your own role.'
      );
    }

    const body = validate(roleChangeSchema, parseBody(event));

    const targetRow = await getItem<{ role?: MembershipRole; email?: string }>(
      memberByWorkspacePK(ctx.workspaceId),
      memberByWorkspaceSK(targetUserId)
    );
    if (!targetRow) throw new HttpError(404, 'NOT_FOUND', 'Member not found');
    if (targetRow.role === 'owner') {
      throw new HttpError(
        409,
        'CANNOT_DEMOTE_OWNER',
        'The workspace owner role can only change via ownership transfer.'
      );
    }

    const oldRole: MembershipRole = (targetRow.role as MembershipRole | undefined) ?? 'member';
    if (oldRole === body.role) {
      return {
        statusCode: 200,
        body: { data: { userId: targetUserId, role: body.role, unchanged: true } },
      };
    }

    // Update both Membership rows in parallel.
    await Promise.all([
      updateItem(
        memberByWorkspacePK(ctx.workspaceId),
        memberByWorkspaceSK(targetUserId),
        { role: body.role }
      ),
      updateItem(
        membershipByUserPK(targetUserId),
        membershipByUserSK(ctx.workspaceId),
        { role: body.role }
      ),
    ]);

    logger.info('workspace_member_role_changed', {
      workspaceId: ctx.workspaceId,
      targetUserId,
      fromRole: oldRole,
      toRole: body.role,
      by: ctx.callerUserId,
    });

    await recordAuditEvent({
      ctx,
      action: 'workspace.member_role_changed',
      resourceId: targetUserId,
      resourceLabel: targetRow.email,
      meta: { fromRole: oldRole, toRole: body.role },
      sourceIp: getSourceIp(event),
      userAgent: getUserAgent(event),
    });

    // Phase 18 — notify the affected member of their new role.
    void enqueueNotification({
      recipientUserId: targetUserId,
      kind: 'workspace.role_changed',
      title: `Your role in ${ctx.workspaceName} changed`,
      body: `${ctx.callerEmail} changed your role from ${oldRole} to ${body.role}.`,
      href: '/dashboard/settings',
      meta: {
        workspaceId: ctx.workspaceId,
        fromRole: oldRole,
        toRole: body.role,
        changedByEmail: ctx.callerEmail,
      },
    });

    return {
      statusCode: 200,
      body: { data: { userId: targetUserId, role: body.role } },
    };
  }

  throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Unsupported method');
});
