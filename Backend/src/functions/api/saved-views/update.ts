/**
 * PATCH /saved-views/{id}
 *
 * Phase 7b — rename or edit filters on an existing saved view. Any workspace
 * member can edit name + filters (no role gate). 404 if the view doesn't
 * exist under the tenant — prevents cross-workspace edits.
 *
 * Phase 17 — toggling `webhookOnMatch` is a workspace-shared-effect change
 * (it controls real-time webhook delivery). Owner/admin only per Phase 14.
 */

import { z } from 'zod';
import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { getItem, updateItem } from '../../../shared/db/queries';
import { savedViewPK, savedViewSK } from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
  assertAdminOrOwner,
} from '../../../shared/middleware/tenant';
import type { SavedView } from '../../../shared/types';

const filtersSchema = z
  .object({
    minSignificance: z.number().int().min(0).max(10).optional(),
    competitorIds: z.array(z.string().min(1)).max(50).optional(),
    changeTypes: z.array(z.string().min(1)).max(20).optional(),
    sinceDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();

const updateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    filters: filtersSchema.optional(),
    /** Phase 17 — toggle real-time webhook delivery on matching changes. */
    webhookOnMatch: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.filters !== undefined ||
      d.webhookOnMatch !== undefined,
    { message: 'Provide at least one of name, filters, or webhookOnMatch' }
  );

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const id = event.pathParameters?.id;
  if (!id) throw new HttpError(400, 'MISSING_ID', 'View id is required');
  const body = validate(updateSchema, parseBody(event));

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  // Phase 17 — webhookOnMatch is a workspace-shared-effect toggle. Members
  // can still edit name + filters; only admins+owners can flip delivery.
  if (body.webhookOnMatch !== undefined) {
    assertAdminOrOwner(ctx, 'saved view delivery');
  }

  const existing = await getItem<SavedView>(savedViewPK(ctx.tenantUserId), savedViewSK(id));
  if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Saved view not found');

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.filters !== undefined) updates.filters = body.filters;
  if (body.webhookOnMatch !== undefined) updates.webhookOnMatch = body.webhookOnMatch;

  await updateItem(savedViewPK(ctx.tenantUserId), savedViewSK(id), updates);

  logger.info('saved_view_updated', {
    tenantUserId: ctx.tenantUserId,
    callerUserId: ctx.callerUserId,
    workspaceId: ctx.workspaceId,
    viewId: id,
  });

  return {
    statusCode: 200,
    body: {
      data: {
        ...existing,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.filters !== undefined ? { filters: body.filters } : {}),
        ...(body.webhookOnMatch !== undefined ? { webhookOnMatch: body.webhookOnMatch } : {}),
        updatedAt: updates.updatedAt as string,
      },
    },
  };
});
