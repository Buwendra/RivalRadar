/**
 * POST /workspaces/current/transfer-ownership
 *
 * Phase 4c — current owner hands off admin authority to an existing member.
 * The workspace's `ownerUserId` flips to the new owner; both members'
 * Membership rows update so subsequent `resolveTenantContext` calls reflect
 * the new authority.
 *
 * NOT MOVED on transfer: `tenantUserId` (data stays with the original
 * creator's USER#) and the Paddle subscription (billing stays with the
 * original tenant). The frontend confirmation copy makes both caveats
 * explicit so users opt in deliberately.
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
import { getItem, updateItem } from '../../../shared/db/queries';
import {
  workspacePK,
  workspaceSK,
  memberByWorkspacePK,
  memberByWorkspaceSK,
  membershipByUserPK,
  membershipByUserSK,
} from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { recordAuditEvent } from '../../../shared/services/audit';
import { enqueueNotification } from '../../../shared/services/notifications';
import { logger } from '../../../shared/utils/logger';
import type { Workspace } from '../../../shared/types';

const transferSchema = z.object({
  newOwnerUserId: z.string().min(1).max(100),
});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(transferSchema, parseBody(event));

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  assertOwner(ctx, 'workspace ownership');

  if (body.newOwnerUserId === ctx.callerUserId) {
    throw new HttpError(409, 'ALREADY_OWNER', 'You are already the owner of this workspace.');
  }

  const workspace = await getItem<Workspace>(workspacePK(ctx.workspaceId), workspaceSK());
  if (!workspace) throw new HttpError(404, 'NOT_FOUND', 'Workspace not found');

  // Confirm the target is a current member — also gives us their email for
  // audit attribution.
  const targetMember = await getItem<{ userId: string; email?: string }>(
    memberByWorkspacePK(ctx.workspaceId),
    memberByWorkspaceSK(body.newOwnerUserId)
  );
  if (!targetMember) {
    throw new HttpError(
      404,
      'NOT_A_MEMBER',
      'That user is not a member of this workspace.'
    );
  }

  const now = new Date().toISOString();

  // 1. Update the Workspace row. Opportunistically backfill `tenantUserId`
  //    from `ownerUserId` if absent (pre-Phase-4c rows).
  await updateItem(workspacePK(ctx.workspaceId), workspaceSK(), {
    ownerUserId: body.newOwnerUserId,
    tenantUserId: workspace.tenantUserId ?? workspace.ownerUserId,
    updatedAt: now,
  });

  // 2. Flip role on all four Membership rows in parallel. Field-level
  //    updateItem (not full overwrite) so concurrent writes to other fields
  //    on the same rows don't clobber.
  await Promise.all([
    updateItem(memberByWorkspacePK(ctx.workspaceId), memberByWorkspaceSK(body.newOwnerUserId), {
      role: 'owner',
    }),
    updateItem(membershipByUserPK(body.newOwnerUserId), membershipByUserSK(ctx.workspaceId), {
      role: 'owner',
    }),
    updateItem(memberByWorkspacePK(ctx.workspaceId), memberByWorkspaceSK(ctx.callerUserId), {
      role: 'member',
    }),
    updateItem(membershipByUserPK(ctx.callerUserId), membershipByUserSK(ctx.workspaceId), {
      role: 'member',
    }),
  ]);

  await recordAuditEvent({
    ctx,
    action: 'workspace.ownership_transferred',
    resourceId: ctx.workspaceId,
    resourceLabel: ctx.workspaceName,
    meta: {
      fromUserId: ctx.callerUserId,
      toUserId: body.newOwnerUserId,
      fromEmail: ctx.callerEmail,
      ...(targetMember.email ? { toEmail: targetMember.email } : {}),
    },
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  logger.info('workspace_ownership_transferred', {
    workspaceId: ctx.workspaceId,
    fromUserId: ctx.callerUserId,
    toUserId: body.newOwnerUserId,
  });

  // Phase 18 — notify both parties.
  void enqueueNotification({
    recipientUserId: body.newOwnerUserId,
    kind: 'workspace.ownership_received',
    title: `You're now the owner of ${ctx.workspaceName}`,
    body: `${ctx.callerEmail} transferred workspace ownership to you. You can now manage billing, API keys, and member roles.`,
    href: '/dashboard/settings',
    meta: {
      workspaceId: ctx.workspaceId,
      fromUserId: ctx.callerUserId,
      fromEmail: ctx.callerEmail,
    },
  });
  void enqueueNotification({
    recipientUserId: ctx.callerUserId,
    kind: 'workspace.ownership_handed_off',
    title: `You handed off ${ctx.workspaceName}`,
    body: `Ownership transferred to ${
      targetMember.email ?? body.newOwnerUserId
    }. You're now a member of this workspace.`,
    href: '/dashboard/settings',
    meta: {
      workspaceId: ctx.workspaceId,
      toUserId: body.newOwnerUserId,
      ...(targetMember.email ? { toEmail: targetMember.email } : {}),
    },
  });

  return {
    statusCode: 200,
    body: {
      data: {
        workspaceId: ctx.workspaceId,
        ownerUserId: body.newOwnerUserId,
      },
    },
  };
});
