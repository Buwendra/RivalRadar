/**
 * POST /invitations/{token}/accept
 *
 * Phase 4a — accepts a workspace invitation. Authenticated route — the user
 * must be signed in as the invitee to accept (we match on email). Creates
 * the Membership rows in both directions and marks the invitation accepted.
 *
 * Failure modes:
 *   404 NOT_FOUND       — token doesn't exist or already deleted
 *   410 EXPIRED         — TTL elapsed
 *   409 ALREADY_USED    — invitation already accepted
 *   409 EMAIL_MISMATCH  — signed-in user is not the invitee
 *   409 ALREADY_MEMBER  — user is already a member of this workspace
 */

import {
  apiHandler,
  getUserEmail,
  HttpError,
  getSourceIp,
  getUserAgent,
} from '../../../shared/middleware/handler';
import { getItem, putItem, queryGSI, updateItem } from '../../../shared/db/queries';
import {
  invitationPK,
  invitationSK,
  membershipByUserPK,
  membershipByUserSK,
  memberByWorkspacePK,
  memberByWorkspaceSK,
} from '../../../shared/db/keys';
import { logger } from '../../../shared/utils/logger';
import { recordAuditEvent } from '../../../shared/services/audit';
import type { TenantContext } from '../../../shared/middleware/tenant';
import type { WorkspaceInvitation } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const callerEmail = getUserEmail(event);
  const token = event.pathParameters?.token;
  if (!token) throw new HttpError(400, 'MISSING_TOKEN', 'Invitation token is required');

  const invite = await getItem<WorkspaceInvitation>(
    invitationPK(token),
    invitationSK()
  );
  if (!invite) {
    throw new HttpError(404, 'NOT_FOUND', 'Invitation not found.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof invite.expiresAt === 'number' && invite.expiresAt < nowSec) {
    throw new HttpError(410, 'EXPIRED', 'This invitation has expired.');
  }

  if (invite.status !== 'pending') {
    throw new HttpError(409, 'ALREADY_USED', 'This invitation has already been used.');
  }

  // Match invitee email against signed-in caller — invitations are
  // bound to a specific email, not transferable.
  if (invite.inviteeEmail.toLowerCase() !== callerEmail.toLowerCase()) {
    throw new HttpError(
      409,
      'EMAIL_MISMATCH',
      `This invitation is for ${invite.inviteeEmail}. Sign in with that email to accept.`
    );
  }

  // Resolve caller's userId via existing GSI3 pattern
  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', callerEmail, 'USER#');
  if (emailItems.length === 0) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'Sign-in user record not found.');
  }
  const callerUserId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  // Reject if the caller is already a member of this workspace
  const existing = await getItem(
    membershipByUserPK(callerUserId),
    membershipByUserSK(invite.workspaceId)
  );
  if (existing) {
    throw new HttpError(409, 'ALREADY_MEMBER', 'You are already a member of this workspace.');
  }

  const now = new Date().toISOString();

  // Phase 14 — preserve the invitation's role onto the membership. Pre-Phase-14
  // invites have no role field; default to 'member'.
  const inviteRole = invite.role ?? 'member';

  // Create both membership directions in parallel
  await Promise.all([
    putItem({
      PK: membershipByUserPK(callerUserId),
      SK: membershipByUserSK(invite.workspaceId),
      workspaceId: invite.workspaceId,
      userId: callerUserId,
      role: inviteRole,
      joinedAt: now,
      workspaceName: invite.workspaceName,
    }),
    putItem({
      PK: memberByWorkspacePK(invite.workspaceId),
      SK: memberByWorkspaceSK(callerUserId),
      workspaceId: invite.workspaceId,
      userId: callerUserId,
      role: inviteRole,
      joinedAt: now,
      email: callerEmail,
    }),
    updateItem(invitationPK(token), invitationSK(), {
      status: 'accepted',
      acceptedAt: now,
      acceptedByUserId: callerUserId,
    }),
  ]);

  logger.info('workspace_invitation_accepted', {
    workspaceId: invite.workspaceId,
    token,
    callerUserId,
    callerEmail,
  });

  // Audit event under the workspace the user just joined.
  const acceptCtx: TenantContext = {
    tenantUserId: invite.workspaceId, // not used by audit writer
    callerUserId,
    callerEmail,
    workspaceId: invite.workspaceId,
    workspaceName: invite.workspaceName,
    role: inviteRole,
  };
  await recordAuditEvent({
    ctx: acceptCtx,
    action: 'workspace.invitation_accepted',
    resourceId: token,
    meta: { role: inviteRole },
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  return {
    statusCode: 200,
    body: {
      data: {
        workspaceId: invite.workspaceId,
        workspaceName: invite.workspaceName,
        role: inviteRole,
      },
    },
  };
});
