/**
 * PATCH /v1/competitors/{id}/snooze
 *
 * Phase 13 — public write API. Auth via X-API-Key with `write` scope.
 * Strategist+ only. Mirrors `competitors/snooze.ts` semantics.
 */

import { z } from 'zod';
import {
  apiHandler,
  parseBody,
  HttpError,
  getSourceIp,
  getUserAgent,
} from '../../../shared/middleware/handler';
import {
  resolveApiKeyContext,
  assertApiAccess,
} from '../../../shared/middleware/api-key';
import { getItem, updateItem } from '../../../shared/db/queries';
import { competitorPK, competitorSK } from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { recordAuditEvent } from '../../../shared/services/audit';
import { logger } from '../../../shared/utils/logger';
import type { PublicEvent } from '../../../shared/middleware/handler';
import type { Competitor } from '../../../shared/types';

const snoozeSchema = z.object({
  /** ISO timestamp; pass `null` to clear (un-snooze). */
  snoozedUntil: z.string().datetime().nullable(),
});

export const handler = apiHandler<PublicEvent>(async (event) => {
  const ctx = await resolveApiKeyContext(event, { requireScope: 'write' });
  await assertApiAccess(ctx);

  const compId = event.pathParameters?.id;
  if (!compId) throw new HttpError(400, 'MISSING_ID', 'Competitor id is required');

  const body = validate(snoozeSchema, parseBody(event));
  const userId = ctx.tenantUserId;

  const competitor = await getItem<Competitor & Record<string, unknown>>(
    competitorPK(userId),
    competitorSK(compId)
  );
  if (!competitor) throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now.toISOString() };

  if (body.snoozedUntil === null) {
    updates.snoozedUntil = null;
    updates.snoozedAt = null;
  } else {
    const untilMs = Date.parse(body.snoozedUntil);
    if (!Number.isFinite(untilMs) || untilMs <= now.getTime()) {
      throw new HttpError(
        400,
        'INVALID_SNOOZE',
        'snoozedUntil must be a future ISO timestamp.'
      );
    }
    updates.snoozedUntil = body.snoozedUntil;
    updates.snoozedAt = now.toISOString();
  }

  await updateItem(competitorPK(userId), competitorSK(compId), updates);

  await recordAuditEvent({
    ctx,
    action: 'api.competitor_snoozed',
    resourceId: compId,
    resourceLabel: competitor.name,
    meta: {
      snoozedUntil: body.snoozedUntil ?? 'cleared',
    },
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  logger.info('api_competitor_snoozed', {
    workspaceId: ctx.workspaceId,
    competitorId: compId,
    snoozedUntil: body.snoozedUntil,
  });

  return {
    statusCode: 200,
    body: {
      data: {
        id: compId,
        snoozedUntil: updates.snoozedUntil,
        snoozedAt: updates.snoozedAt,
      },
    },
  };
});
