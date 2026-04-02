import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { deleteItem, getItem, queryGSI } from '../../../shared/db/queries';
import { competitorPK, competitorSK } from '../../../shared/db/keys';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const compId = event.pathParameters?.id;

  if (!compId) throw new HttpError(400, 'MISSING_ID', 'Competitor ID is required');

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const competitor = await getItem<Record<string, unknown>>(competitorPK(userId), competitorSK(compId));
  if (!competitor) {
    throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');
  }

  await deleteItem(competitorPK(userId), competitorSK(compId));

  return {
    statusCode: 200,
    body: { data: { message: 'Competitor deleted' } },
  };
});
