/**
 * GDPR Art. 15 (Right of Access) + Art. 20 (Right to Data Portability) +
 * CCPA §1798.110 (Right to Know).
 *
 * Returns the requesting user's full data dump as machine-readable JSON.
 * Synchronous response when payload < 5MB (covers >99% of accounts at MVP
 * scale); future enhancement is async S3-presigned-URL via email when bigger.
 */
import {
  apiHandler,
  getUserEmail,
  HttpError,
} from '../../../shared/middleware/handler';
import { getItem, queryByPK, queryGSI } from '../../../shared/db/queries';
import {
  userPK,
  userSK,
  competitorPK,
  subscriptionPK,
  subscriptionSK,
} from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { logger } from '../../../shared/utils/logger';

const MAX_INLINE_BYTES = 5 * 1024 * 1024; // 5 MB

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const exportId = generateId();
  const requestedAt = new Date().toISOString();

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  // Load user + subscription + all competitors in parallel
  const [user, subscription, competitorsResult] = await Promise.all([
    getItem<Record<string, unknown>>(userPK(userId), userSK()),
    getItem<Record<string, unknown>>(subscriptionPK(userId), subscriptionSK()),
    queryByPK(competitorPK(userId), 'COMP#'),
  ]);
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  const competitors = competitorsResult.items;

  // For each competitor, fetch all changes + research findings (sequential to
  // bound concurrency; users have at most 25 competitors per plan)
  const changesByCompetitor: Record<string, unknown[]> = {};
  const researchByCompetitor: Record<string, unknown[]> = {};
  for (const comp of competitors) {
    const compId = comp.id as string;
    const [changesResult, researchResult] = await Promise.all([
      queryByPK(`COMP#${compId}`, 'CHANGE#'),
      queryByPK(`COMP#${compId}`, 'RESEARCH#'),
    ]);
    changesByCompetitor[compId] = changesResult.items;
    researchByCompetitor[compId] = researchResult.items;
  }

  const exportPayload = {
    exportId,
    requestedAt,
    requestedBy: { userId, email },
    standard: 'GDPR Art. 15+20 / CCPA §1798.110',
    schemaVersion: 1,
    data: {
      user,
      subscription,
      competitors,
      changesByCompetitor,
      researchByCompetitor,
    },
  };

  const serialized = JSON.stringify(exportPayload);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');

  if (sizeBytes > MAX_INLINE_BYTES) {
    // Defer: surface a clear message rather than blow up API Gateway.
    // Future enhancement: write to S3 and email a presigned URL.
    logger.warn('export_payload_oversized', {
      userId,
      exportId,
      sizeBytes,
      maxInlineBytes: MAX_INLINE_BYTES,
    });
    throw new HttpError(
      413,
      'EXPORT_TOO_LARGE',
      `Your data export is ${(sizeBytes / 1024 / 1024).toFixed(2)} MB which exceeds the inline limit. Email support@rivalscan.com to receive an emailed download link.`
    );
  }

  logger.info('user_data_export', {
    userId,
    exportId,
    sizeBytes,
    competitorCount: competitors.length,
  });

  return {
    statusCode: 200,
    body: { data: exportPayload },
  };
});
