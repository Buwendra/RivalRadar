import {
  apiHandler,
  getUserEmail,
  parseBody,
  HttpError,
  getSourceIp,
  getUserAgent,
} from '../../../shared/middleware/handler';
import { getItem, updateItem } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { getPaddleClient } from '../../../shared/services/paddle';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
  assertOwner,
} from '../../../shared/middleware/tenant';
import { recordAuditEvent } from '../../../shared/services/audit';
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

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  assertOwner(ctx, 'billing');
  const userId = ctx.tenantUserId;

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

  await recordAuditEvent({
    ctx,
    action: 'subscription.checkout_started',
    meta: { plan: body.plan },
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  return {
    statusCode: 200,
    body: { data: { checkoutUrl: transaction.checkout?.url } },
  };
});
