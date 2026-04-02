import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { getItem, queryGSI } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';
import { getPaddleClient } from '../../../shared/services/paddle';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

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
