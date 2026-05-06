import { z } from 'zod';
import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { deleteItem } from '../../../shared/db/queries';
import { integrationPK, integrationSK } from '../../../shared/db/keys';
import { logger } from '../../../shared/utils/logger';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
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

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  await deleteItem(integrationPK(userId), integrationSK(provider));

  logger.info('integration_deleted', { userId, provider });

  return {
    statusCode: 200,
    body: { data: { provider, deleted: true } },
  };
});
