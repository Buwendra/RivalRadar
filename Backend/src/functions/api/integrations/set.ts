import { z } from 'zod';
import { randomBytes } from 'crypto';
import { apiHandler, getUserEmail, HttpError, parseBody } from '../../../shared/middleware/handler';
import { queryGSI, putItem, getItem } from '../../../shared/db/queries';
import { integrationPK, integrationSK } from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import type { IntegrationCredential, IntegrationProvider } from '../../../shared/types';

const slackSchema = z.object({
  provider: z.literal('slack'),
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://hooks.slack.com/'), {
      message: 'Slack webhook URL must start with https://hooks.slack.com/',
    }),
  meta: z.record(z.string(), z.string()).optional(),
});

const webhookSchema = z.object({
  provider: z.literal('webhook'),
  url: z.string().url().refine((u) => u.startsWith('https://'), {
    message: 'Webhook URL must use HTTPS',
  }),
  meta: z.record(z.string(), z.string()).optional(),
});

const setSchema = z.discriminatedUnion('provider', [slackSchema, webhookSchema]);

/**
 * POST /integrations
 *
 * Create-or-replace the user's integration credential for a given provider.
 * For `webhook`, generates a fresh HMAC secret on every set — returned ONCE
 * in the response so the user can copy it. Subsequent reads via GET /integrations
 * never echo the secret back.
 *
 * SECURITY: never logs the URL or hmacSecret. Only logs provider + userId.
 */
export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(setSchema, parseBody(event));

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const provider: IntegrationProvider = body.provider;
  const now = new Date().toISOString();

  // For webhooks: rotate the HMAC secret on each set (whether brand-new or
  // re-pasted URL). This is intentional — pasting a new URL is also a good
  // moment to rotate the signing secret. For Slack: no HMAC secret needed
  // since incoming webhooks rely on the URL itself being unguessable.
  let hmacSecret: string | undefined;
  if (provider === 'webhook') {
    hmacSecret = randomBytes(32).toString('hex');
  }

  // Preserve createdAt across replacements
  const existing = await getItem<IntegrationCredential>(
    integrationPK(userId),
    integrationSK(provider)
  );

  const row: IntegrationCredential = {
    userId,
    provider,
    secret: body.url,
    ...(hmacSecret ? { hmacSecret } : {}),
    ...(body.meta ? { meta: body.meta } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await putItem({
    PK: integrationPK(userId),
    SK: integrationSK(provider),
    ...row,
  });

  logger.info('integration_set', { userId, provider, replaced: !!existing });

  // Response shape: only echo the hmacSecret on webhook creation. Never echo
  // the URL — the caller knows it (they just sent it).
  return {
    statusCode: 200,
    body: {
      data: {
        provider,
        ...(hmacSecret ? { hmacSecret } : {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    },
  };
});
