import { z } from 'zod';
import { apiHandler, getUserEmail, HttpError, parseBody } from '../../../shared/middleware/handler';
import { queryByPK, updateItem } from '../../../shared/db/queries';
import { recommendationPK } from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { Recommendation, RecommendationStatus } from '../../../shared/types';

const updateSchema = z.object({
  status: z.enum(['open', 'dismissed', 'acted-on']),
});

/**
 * PATCH /recommendations/{id}
 *
 * Updates a recommendation's status to one of: open / dismissed / acted-on.
 * The recommendation row itself is otherwise immutable — only status +
 * dismissedAt / actedAt change.
 *
 * Why a scan instead of a direct getItem: recommendations are sort-keyed by
 * createdAt ISO timestamp, not by id, so we don't have the SK from the
 * client-supplied {id}. The list of recs per user is small (<100 typical)
 * so a scoped queryByPK + filter is cheap.
 */
export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const recId = event.pathParameters?.id;
  if (!recId) throw new HttpError(400, 'MISSING_ID', 'Recommendation id is required');

  const body = validate(updateSchema, parseBody(event));

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  // Locate the rec row by id (REC# SK prefix scoped to this user)
  const { items } = await queryByPK(recommendationPK(userId), 'REC#', { limit: 100 });
  const target = items.find((r) => r.id === recId) as unknown as Recommendation | undefined;
  if (!target) throw new HttpError(404, 'NOT_FOUND', 'Recommendation not found');

  const now = new Date().toISOString();
  const newStatus: RecommendationStatus = body.status;
  const updates: Record<string, unknown> = { status: newStatus, updatedAt: now };

  if (newStatus === 'dismissed') updates.dismissedAt = now;
  if (newStatus === 'acted-on') updates.actedAt = now;
  // Clearing back to 'open' is allowed but doesn't unset dismissed/actedAt —
  // the timestamps document the historical transitions. Phase 8's prompt
  // A/B framework reads `actedAt` as the outcome signal.

  // SK reconstruction: we know it from the row we just fetched
  const sk = (target as Recommendation & { SK?: string }).SK as string | undefined;
  if (!sk) {
    logger.error('updateRecommendationStatus: row missing SK attribute', { recId, userId });
    throw new HttpError(500, 'INTERNAL', 'Recommendation row missing SK');
  }

  await updateItem(recommendationPK(userId), sk, updates);

  // Log outcome event for Phase 8 prompt-quality analysis
  if (newStatus === 'acted-on') {
    logger.info('recommendation_acted_on', {
      recId,
      userId,
      category: target.category,
      timeHorizon: target.timeHorizon,
      effortLevel: target.effortLevel,
      confidence: target.confidence,
      ageHours:
        (Date.now() - Date.parse(target.createdAt)) / (60 * 60 * 1000),
    });
  } else if (newStatus === 'dismissed') {
    logger.info('recommendation_dismissed', {
      recId,
      userId,
      category: target.category,
      ageHours:
        (Date.now() - Date.parse(target.createdAt)) / (60 * 60 * 1000),
    });
  }

  return {
    statusCode: 200,
    body: { data: { id: recId, status: newStatus } },
  };
});
