import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { getItem } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';
import { getPaddleClient } from '../../../shared/services/paddle';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await getItem<Record<string, unknown>>(userPK(userId), userSK());
  if (!user?.paddleCustomerId) {
    throw new HttpError(400, 'NO_SUBSCRIPTION', 'No billing account found. Subscribe first.');
  }

  const paddle = await getPaddleClient();

  const session = await paddle.customerPortalSessions.create(
    user.paddleCustomerId as string,
    []
  );

  return {
    statusCode: 200,
    body: { data: { portalUrl: session.urls.general } },
  };
});
