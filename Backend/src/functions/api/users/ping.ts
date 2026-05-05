/**
 * POST /users/me/ping
 *
 * Phase 8a — bumps the user's `lastLoginAt` to now. Called once per session
 * from the dashboard layout's mount effect (frontend guards with a
 * sessionStorage flag so it doesn't re-fire on intra-session navigation).
 *
 * The retention-nudge cron uses this timestamp to identify users who
 * haven't returned in 7+ days; without the ping, we'd only have signin
 * times to go on, which miss long-session-token users entirely.
 */

import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryGSI, updateItem } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);

  const { items } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (items.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (items[0].GSI3SK as string).replace('USER#', '');

  const now = new Date().toISOString();
  await updateItem(userPK(userId), userSK(), {
    lastLoginAt: now,
    updatedAt: now,
  });

  return {
    statusCode: 200,
    body: { data: { pinged: true } },
  };
});
