/**
 * POST /cancellation-feedback/{token}
 *
 * Phase 8b — public route (no auth — the user is post-cancellation, likely
 * logged out). Token-validated: the token was minted by the Paddle webhook
 * and embedded in the survey-email link. Look up the row, confirm not
 * expired, confirm not already submitted, then write the responses.
 *
 * Idempotency: a duplicate submit returns 409 ALREADY_SUBMITTED rather
 * than silently accepting — better UX than letting users think their
 * second answer overwrote the first.
 */

import { z } from 'zod';
import {
  apiHandler,
  HttpError,
  parseBody,
  PublicEvent,
} from '../../../shared/middleware/handler';
import { getItem, updateItem } from '../../../shared/db/queries';
import { cancelFeedbackPK, cancelFeedbackSK } from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import type { CancellationFeedback } from '../../../shared/types';

const submitSchema = z.object({
  reason: z.enum([
    'price',
    'value',
    'missing-features',
    'usability',
    'switched',
    'no-longer-needed',
    'temporary-pause',
    'other',
  ]),
  freeText: z.string().max(2000).optional(),
});

export const handler = apiHandler<PublicEvent>(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) throw new HttpError(400, 'MISSING_TOKEN', 'Token is required');

  const body = validate(submitSchema, parseBody(event));

  const row = await getItem<CancellationFeedback>(
    cancelFeedbackPK(token),
    cancelFeedbackSK()
  );
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Survey link not found or already expired');

  // TTL is set on the row so DynamoDB will eventually purge expired rows,
  // but TTL is best-effort with up to 48h delay; check expiresAt explicitly.
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof row.expiresAt === 'number' && row.expiresAt < nowSec) {
    throw new HttpError(410, 'EXPIRED', 'This survey link has expired.');
  }

  if (row.submittedAt) {
    throw new HttpError(409, 'ALREADY_SUBMITTED', 'This survey has already been submitted.');
  }

  const submittedAt = new Date().toISOString();
  await updateItem(cancelFeedbackPK(token), cancelFeedbackSK(), {
    reason: body.reason,
    ...(body.freeText && body.freeText.trim() ? { freeText: body.freeText.trim() } : {}),
    submittedAt,
  });

  logger.info('cancellation_feedback_submitted', {
    token,
    userId: row.userId,
    plan: row.plan,
    reason: body.reason,
    hasFreeText: !!(body.freeText && body.freeText.trim()),
  });

  return {
    statusCode: 200,
    body: { data: { message: 'Thanks for the feedback.' } },
  };
});
