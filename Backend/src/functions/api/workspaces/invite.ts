/**
 * POST /workspaces/current/invitations
 *
 * Phase 4a — owner creates an invitation by email. Generates an opaque
 * ULID token, stores a WorkspaceInvitation row with a 14-day TTL, and
 * sends the invitee a tokenized accept link via SES. The accept handler
 * (public, no auth) is at POST /invitations/{token}/accept.
 *
 * Idempotency: re-inviting the same email creates a new token. Old tokens
 * stay valid until they expire — convenient for "I lost the link, send
 * again" scenarios.
 */

import { z } from 'zod';
import {
  apiHandler,
  getUserEmail,
  HttpError,
  parseBody,
  getSourceIp,
  getUserAgent,
} from '../../../shared/middleware/handler';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
  assertAdminOrOwner,
} from '../../../shared/middleware/tenant';
import { putItem } from '../../../shared/db/queries';
import { invitationPK, invitationSK } from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { sendEmail } from '../../../shared/services/ses';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import { recordAuditEvent } from '../../../shared/services/audit';
import type { WorkspaceInvitation } from '../../../shared/types';

const TTL_DAYS = 14;

const inviteSchema = z.object({
  email: z.string().email().toLowerCase(),
  /**
   * Phase 14 — role the invitee receives on accept. Defaults to 'member'.
   * Inviting an admin requires the caller to be the workspace owner; admins
   * inviting another admin returns 403 ADMIN_INVITE_OWNER_ONLY.
   */
  role: z.enum(['member', 'admin']).optional().default('member'),
});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const requestedWsId = getRequestedWorkspaceId(event.headers as Record<string, string | undefined>);
  const ctx = await resolveTenantContext(email, requestedWsId);

  assertAdminOrOwner(ctx, 'workspace members');

  const body = validate(inviteSchema, parseBody(event));

  // Inviting an admin is owner-only — closes the second-owner-attack vector
  // where an admin could promote a colluder.
  if (body.role === 'admin' && ctx.role !== 'owner') {
    throw new HttpError(
      403,
      'ADMIN_INVITE_OWNER_ONLY',
      'Only the workspace owner can invite admins. Admins can invite members.'
    );
  }

  if (body.email === ctx.callerEmail) {
    throw new HttpError(409, 'INVITE_SELF', "You're already in this workspace.");
  }

  const now = new Date();
  const token = generateId();
  const expiresAtSec = Math.floor(now.getTime() / 1000) + TTL_DAYS * 24 * 60 * 60;

  const row: WorkspaceInvitation = {
    token,
    workspaceId: ctx.workspaceId,
    workspaceName: ctx.workspaceName,
    inviterUserId: ctx.callerUserId,
    inviterEmail: ctx.callerEmail,
    inviteeEmail: body.email,
    role: body.role,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: expiresAtSec,
  };

  await putItem({
    PK: invitationPK(token),
    SK: invitationSK(),
    ...row,
  });

  // Email the invitee. Best-effort — failure logs but doesn't unwind the
  // invitation row (the owner can re-send by re-inviting).
  const acceptUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/accept-invitation/${token}`;
  try {
    await sendEmail(
      body.email,
      `${ctx.callerEmail} invited you to ${ctx.workspaceName} on RivalScan`,
      `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="padding: 24px 28px;">
            <p>Hi,</p>
            <p><strong>${ctx.callerEmail}</strong> invited you to join the
            <strong>${ctx.workspaceName}</strong> workspace on RivalScan —
            a competitive intelligence platform that tracks your competitors
            and surfaces strategic insights every week.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${acceptUrl}" style="background: #2563eb; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                Accept invitation
              </a>
            </div>
            <p style="color: #6b7280; font-size: 12px;">
              The invitation expires in ${TTL_DAYS} days. If you don't have a
              RivalScan account yet, you'll be prompted to sign up first.
            </p>
          </div>
        </div>
      `
    );
  } catch (err) {
    logger.warn('invitation_email_failed', {
      token,
      inviteeEmail: body.email,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('workspace_invitation_created', {
    workspaceId: ctx.workspaceId,
    token,
    inviterUserId: ctx.callerUserId,
    inviteeEmail: body.email,
  });

  await recordAuditEvent({
    ctx,
    action: 'workspace.invitation_created',
    resourceId: token,
    resourceLabel: body.email,
    meta: { role: body.role },
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  return {
    statusCode: 201,
    body: {
      data: {
        token,
        workspaceName: ctx.workspaceName,
        inviteeEmail: body.email,
        role: body.role,
        expiresAt: new Date(expiresAtSec * 1000).toISOString(),
      },
    },
  };
});
