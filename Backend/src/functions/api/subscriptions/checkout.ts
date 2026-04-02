import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { getItem, updateItem, queryGSI } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { getPaddleClient } from '../../../shared/services/paddle';
import { z } from 'zod';

const checkoutSchema = z.object({
  plan: z.enum(['scout', 'strategist', 'command']),
});

const PADDLE_PRICES: Record<string, string> = {
  scout: process.env.PADDLE_PRICE_SCOUT ?? '',
  strategist: process.env.PADDLE_PRICE_STRATEGIST ?? '',
  command: process.env.PADDLE_PRICE_COMMAND ?? '',
};

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(checkoutSchema, parseBody(event));

  const priceId = PADDLE_PRICES[body.plan];
  if (!priceId) {
    throw new HttpError(500, 'PRICE_NOT_CONFIGURED', `Paddle price ID for plan "${body.plan}" is not configured`);
  }

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const user = await getItem<Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  const paddle = await getPaddleClient();

  let customerId = user.paddleCustomerId as string | undefined;
  if (!customerId) {
    const customer = await paddle.customers.create({
      email: user.email as string,
      name: user.name as string,
    });
    customerId = customer.id;
    await updateItem(userPK(userId), userSK(), { paddleCustomerId: customerId });
  }

  const transaction = await paddle.transactions.create({
    items: [{ priceId, quantity: 1 }],
    customerId,
    customData: { userId, plan: body.plan },
    checkout: {
      url: `${process.env.FRONTEND_URL}/dashboard?checkout=success`,
    },
  });

  return {
    statusCode: 200,
    body: { data: { checkoutUrl: transaction.checkout?.url } },
  };
});
