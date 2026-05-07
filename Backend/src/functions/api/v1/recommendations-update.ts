/**
 * PATCH /v1/recommendations/{id}
 *
 * Phase 13 — public write API. Auth via X-API-Key with `write` scope.
 * Strategist+ only. Mirrors `recommendations/update-status.ts` semantics:
 * status transitions to one of open / dismissed / acted-on; the row is
 * otherwise immutable.
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
import { queryByPK, updateItem } from '../../../shared/db/queries';
import { recommendationPK } from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { recordAuditEvent } from '../../../shared/services/audit';
import { logger } from '../../../shared/utils/logger';
import type { PublicEvent } from '../../../shared/middleware/handler';
import type { Recommendation, RecommendationStatus } from '../../../shared/types';

const updateSchema = z.object({
  status: z.enum(['open', 'dismissed', 'acted-on']),
});

export const handler = apiHandler<PublicEvent>(async (event) => {
  const ctx = await resolveApiKeyContext(event, { requireScope: 'write' });
  await assertApiAccess(ctx);

  const recId = event.pathParameters?.id;
  if (!recId) throw new HttpError(400, 'MISSING_ID', 'Recommendation id is required');

  const body = validate(updateSchema, parseBody(event));
  const userId = ctx.tenantUserId;

  // Same scan-find pattern as the dashboard handler — recs are sort-keyed by
  // createdAt, so we recover the SK from the row we find.
  const { items } = await queryByPK(recommendationPK(userId), 'REC#', { limit: 100 });
  const target = items.find((r) => r.id === recId) as unknown as Recommendation | undefined;
  if (!target) throw new HttpError(404, 'NOT_FOUND', 'Recommendation not found');

  const oldStatus = target.status;
  const newStatus: RecommendationStatus = body.status;
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status: newStatus, updatedAt: now };
  if (newStatus === 'dismissed') updates.dismissedAt = now;
  if (newStatus === 'acted-on') updates.actedAt = now;

  const sk = (target as Recommendation & { SK?: string }).SK as string | undefined;
  if (!sk) {
    logger.error('api_v1_rec_update: row missing SK attribute', { recId, userId });
    throw new HttpError(500, 'INTERNAL', 'Recommendation row missing SK');
  }

  await updateItem(recommendationPK(userId), sk, updates);

  await recordAuditEvent({
    ctx,
    action: 'api.recommendation_updated',
    resourceId: recId,
    resourceLabel: target.title,
    meta: { status: newStatus, oldStatus: oldStatus ?? 'unknown' },
    sourceIp: getSourceIp(event),
    userAgent: getUserAgent(event),
  });

  // Mirror the dashboard handler's outcome events for Phase 8 prompt-quality
  // analysis. Same log shape; analysis treats them identically.
  if (newStatus === 'acted-on') {
    logger.info('recommendation_acted_on', {
      recId,
      userId,
      category: target.category,
      timeHorizon: target.timeHorizon,
      effortLevel: target.effortLevel,
      confidence: target.confidence,
      ageHours: (Date.now() - Date.parse(target.createdAt)) / (60 * 60 * 1000),
      via: 'api',
    });
  } else if (newStatus === 'dismissed') {
    logger.info('recommendation_dismissed', {
      recId,
      userId,
      category: target.category,
      ageHours: (Date.now() - Date.parse(target.createdAt)) / (60 * 60 * 1000),
      via: 'api',
    });
  }

  return {
    statusCode: 200,
    body: { data: { id: recId, status: newStatus } },
  };
});
