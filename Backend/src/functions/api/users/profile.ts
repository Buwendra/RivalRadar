import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { getItem, queryGSI, updateItem } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';
import { User } from '../../../shared/types';
import { validate } from '../../../shared/middleware/validation';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const method = event.requestContext.http.method;

  // Find userId via GSI3 (email lookup)
  const { items } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (items.length === 0) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  }
  const userId = (items[0].GSI3SK as string).replace('USER#', '');

  if (method === 'GET') {
    const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }

    return {
      statusCode: 200,
      body: {
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          onboardingComplete: user.onboardingComplete,
          createdAt: user.createdAt,
        },
      },
    };
  }

  // PUT
  const body = validate(updateSchema, parseBody(event));
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name) updates.name = body.name;

  await updateItem(userPK(userId), userSK(), updates);

  return {
    statusCode: 200,
    body: { data: { message: 'Profile updated' } },
  };
});
