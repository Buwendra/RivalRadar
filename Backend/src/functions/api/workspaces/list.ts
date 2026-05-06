/**
 * GET /workspaces
 *
 * Phase 4a — returns the workspaces the calling user is a member of, with
 * role + the workspace name. Used by the frontend switcher dropdown.
 *
 * Bypasses `resolveTenantContext` because the resolver itself uses the
 * memberships — we just want the raw list, even before any one is selected.
 */

import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryGSI, queryByPK } from '../../../shared/db/queries';
import { membershipByUserPK, membershipByUserSKPrefix } from '../../../shared/db/keys';
import type { Membership } from '../../../shared/types';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const { items } = await queryByPK(
    membershipByUserPK(userId),
    membershipByUserSKPrefix()
  );
  const memberships = items as unknown as Membership[];

  return {
    statusCode: 200,
    body: {
      data: memberships.map((m) => ({
        workspaceId: m.workspaceId,
        workspaceName: m.workspaceName ?? '(unnamed)',
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    },
  };
});
