/**
 * POST /users/me/suspend  +  POST /users/me/resume
 *
 * Phase 9a — GDPR Art. 18 (Right to Restriction of Processing). Lets a user
 * voluntarily suspend their own account without deleting it. They can resume
 * at any time without re-onboarding.
 *
 * Sets `User.status` to 'restricted' (suspend) or 'active' (resume). The
 * existing `enforceResearchEligibility` helper from Phase 1 already gates on
 * status, so:
 *   - Recurring research is automatically blocked (the enqueuer calls the
 *     same helper) — competitors are silently skipped while restricted.
 *   - Manual "Research Now" returns ACCOUNT_RESTRICTED.
 *   - Onboarding is blocked by the same gate.
 *
 * What is NOT yet blocked while restricted (defer to a follow-up if it
 * matters): the Monday weekly digest still goes out (the digest pipeline's
 * get-subscribers handler doesn't currently filter on status). Critical
 * alerts also still fire if research is somehow triggered. For Phase 9a,
 * "stop research" + "user can hide their account" is the GDPR Art. 18
 * substance; full email-suppression can happen via the Phase 3 notification
 * preferences (uncheck weekly digest) or as a Phase 9b addition.
 */

import {
  apiHandler,
  getUserEmail,
  HttpError,
  getSourceIp,
  getUserAgent,
} from '../../../shared/middleware/handler';
import { updateItem } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';
import { logger } from '../../../shared/utils/logger';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { recordAuditEvent } from '../../../shared/services/audit';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const path = event.requestContext.http.path;
  const wantSuspend = path.endsWith('/suspend');
  const wantResume = path.endsWith('/resume');
  if (!wantSuspend && !wantResume) {
    throw new HttpError(404, 'NOT_FOUND', 'Unknown route');
  }

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.callerUserId;

  const newStatus = wantSuspend ? 'restricted' : 'active';
  const now = new Date().toISOString();
  await updateItem(userPK(userId), userSK(), {
    status: newStatus,
    updatedAt: now,
  });

  logger.info(wantSuspend ? 'account_self_suspended' : 'account_self_resumed', {
    userId,
    email,
  });

  await recordAuditEvent({
    ctx,
    action: wantSuspend ? 'account.suspended' : 'account.resumed',
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  return {
    statusCode: 200,
    body: { data: { status: newStatus } },
  };
});
