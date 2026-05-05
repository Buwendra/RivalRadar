import { z } from 'zod';
import { apiHandler, getUserEmail, HttpError, parseBody } from '../../../shared/middleware/handler';
import { getItem, queryGSI, updateItem } from '../../../shared/db/queries';
import { competitorPK, competitorSK } from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import type { Competitor } from '../../../shared/types';

const snoozeSchema = z.object({
  /**
   * ISO timestamp when the snooze expires. Pass `null` to clear (un-snooze).
   * Common UI presets: 7d / 30d / 90d / Forever (set to year 9999).
   */
  snoozedUntil: z.string().datetime().nullable(),
});

/**
 * PATCH /competitors/{id}/snooze
 *
 * Phase 7a — sets or clears `snoozedUntil` on a competitor. While snoozed:
 *   - Recurring research scheduler skips this competitor.
 *   - Weekly digest aggregation filters out their changes + snapshot.
 *   - Manual "Research Now" returns 409 COMPETITOR_SNOOZED.
 *   - Real-time critical alerts source-gated by the manual+recurring paths
 *     not running for this competitor (no separate gate inside deep-research
 *     since a snoozed competitor shouldn't reach it in the first place).
 *
 * Auto-expiry happens passively — once `now > snoozedUntil`, the helper
 * `isSnoozed()` returns false and all gates lift on their own without
 * needing a cleanup cron.
 */
export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const compId = event.pathParameters?.id;
  if (!compId) throw new HttpError(400, 'MISSING_ID', 'Competitor id is required');

  const body = validate(snoozeSchema, parseBody(event));

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const competitor = await getItem<Competitor & Record<string, unknown>>(
    competitorPK(userId),
    competitorSK(compId)
  );
  if (!competitor) throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now.toISOString() };

  if (body.snoozedUntil === null) {
    // Clearing — DynamoDB UPDATE with null value will write the attribute
    // as NULL, which is fine: isSnoozed() treats null/undefined identically.
    updates.snoozedUntil = null;
    updates.snoozedAt = null;
    logger.info('competitor_unsnoozed', { userId, competitorId: compId });
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
    logger.info('competitor_snoozed', {
      userId,
      competitorId: compId,
      snoozedUntil: body.snoozedUntil,
      durationDays: Math.round((untilMs - now.getTime()) / (24 * 60 * 60 * 1000)),
    });
  }

  await updateItem(competitorPK(userId), competitorSK(compId), updates);

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
