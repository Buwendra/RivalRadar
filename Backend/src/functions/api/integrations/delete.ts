import { z } from 'zod';
import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryGSI, deleteItem } from '../../../shared/db/queries';
import { integrationPK, integrationSK } from '../../../shared/db/keys';
import { logger } from '../../../shared/utils/logger';
import type { IntegrationProvider } from '../../../shared/types';

const providerSchema = z.enum(['slack', 'webhook']);

/**
 * DELETE /integrations/{provider}
 *
 * Removes the user's credential for the given provider. Idempotent — returns
 * 200 even if no credential existed (the UI's "disconnect" button shouldn't
 * 404 just because someone double-clicked).
 */
export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const providerRaw = event.pathParameters?.provider;
  const provider: IntegrationProvider = providerSchema.parse(providerRaw);

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  await deleteItem(integrationPK(userId), integrationSK(provider));

  logger.info('integration_deleted', { userId, provider });

  return {
    statusCode: 200,
    body: { data: { provider, deleted: true } },
  };
});
