/**
 * POST /saved-views
 *
 * Phase 7b — create a named saved view. The `savedViews.max` capability
 * (Scout 0, Strategist 5, Command 25) gates creation. The cap is read from
 * the tenant owner's plan — workspace members inherit the owner's tier.
 */

import { z } from 'zod';
import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { getItem, putItem, queryByPK } from '../../../shared/db/queries';
import {
  savedViewPK,
  savedViewSK,
  savedViewSKPrefix,
  userPK,
  userSK,
} from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { generateId } from '../../../shared/utils/id';
import { capabilitiesFor } from '../../../shared/utils/capability';
import { logger } from '../../../shared/utils/logger';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { User, SavedView } from '../../../shared/types';

const filtersSchema = z
  .object({
    minSignificance: z.number().int().min(0).max(10).optional(),
    competitorIds: z.array(z.string().min(1)).max(50).optional(),
    changeTypes: z.array(z.string().min(1)).max(20).optional(),
    sinceDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();

const createSchema = z.object({
  name: z.string().min(1).max(80),
  filters: filtersSchema,
});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(createSchema, parseBody(event));

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );

  const ownerUser = await getItem<User & Record<string, unknown>>(
    userPK(ctx.tenantUserId),
    userSK()
  );
  if (!ownerUser) throw new HttpError(404, 'USER_NOT_FOUND', 'Workspace owner not found');

  const cap = capabilitiesFor(ownerUser).savedViews.max;
  if (cap === 0) {
    throw new HttpError(
      403,
      'PLAN_REQUIRED',
      'Saved views require the Strategist plan or higher.'
    );
  }

  const { items: existing } = await queryByPK(
    savedViewPK(ctx.tenantUserId),
    savedViewSKPrefix()
  );
  if (cap > 0 && existing.length >= cap) {
    throw new HttpError(
      403,
      'PLAN_LIMIT',
      `Your plan allows up to ${cap} saved views. Delete one or upgrade to add more.`
    );
  }

  const id = generateId();
  const now = new Date().toISOString();
  const row: SavedView = {
    id,
    name: body.name,
    filters: body.filters as SavedView['filters'],
    createdByUserId: ctx.callerUserId,
    createdAt: now,
    updatedAt: now,
  };

  await putItem({
    PK: savedViewPK(ctx.tenantUserId),
    SK: savedViewSK(id),
    ...row,
  });

  logger.info('saved_view_created', {
    tenantUserId: ctx.tenantUserId,
    callerUserId: ctx.callerUserId,
    workspaceId: ctx.workspaceId,
    viewId: id,
  });

  return {
    statusCode: 201,
    body: { data: row },
  };
});
