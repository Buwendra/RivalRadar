import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import { integrationPK } from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { IntegrationCredential, IntegrationProvider } from '../../../shared/types';

/**
 * GET /integrations
 *
 * Returns the user's configured integrations with secrets REDACTED — only
 * the last 12 chars of each URL are echoed back (e.g. "...XXXXXXXXXXXX")
 * so the UI can show the user which integration is connected without
 * leaking the full credential.
 */
export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const { items } = await queryByPK(integrationPK(userId), 'INTEGRATION#');

  const data = (items as unknown as IntegrationCredential[]).map((row) => {
    const secret = String(row.secret ?? '');
    return {
      provider: row.provider as IntegrationProvider,
      secretHint: secret.length > 12 ? `…${secret.slice(-12)}` : `…${secret}`,
      meta: row.meta,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastDeliveryAt: row.lastDeliveryAt,
      lastDeliveryStatus: row.lastDeliveryStatus,
      lastDeliveryError: row.lastDeliveryError,
    };
  });

  return {
    statusCode: 200,
    body: { data },
  };
});
