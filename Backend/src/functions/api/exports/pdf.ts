/**
 * POST /exports/pdf
 *
 * Phase 6b — Strategist+ board-ready PDF briefing.
 *
 * Sequence:
 *   1. Tier-gate via `hasCapability(user, 'pdfExports')` (403 if Scout).
 *   2. Query competitors + last-7d changes + open recommendations in parallel.
 *   3. Render via PDFKit (`renderBriefingPdf`) → Buffer.
 *   4. Upload to s3://snapshotBucket/exports/USER#<id>/<exportId>.pdf with
 *      ContentDisposition set so browsers download (vs render inline).
 *   5. Generate a 7-day presigned GET URL.
 *   6. Return `{ downloadUrl, filename, expiresAt, exportId, pdfBytes }`.
 *
 * The frontend opens `downloadUrl` in a new tab — S3's
 * `Content-Disposition: attachment` header triggers the browser save.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { getItem, queryByPK, queryGSI, skPrefixRange } from '../../../shared/db/queries';
import {
  userPK,
  userSK,
  competitorPK,
  recommendationPK,
} from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { hasCapability } from '../../../shared/utils/capability';
import { renderBriefingPdf } from '../../../shared/utils/pdf-renderer';
import { logger } from '../../../shared/utils/logger';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { User, Competitor, Recommendation } from '../../../shared/types';

const s3 = new S3Client({});

const PRESIGNED_TTL_SEC = 7 * 24 * 60 * 60; // 7 days
const RECENT_REC_DAYS = 30;

export const handler = apiHandler(async (event) => {
  const startedAt = Date.now();
  const email = getUserEmail(event);

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  if (!hasCapability(user, 'pdfExports')) {
    throw new HttpError(
      403,
      'PLAN_REQUIRED',
      'PDF exports require the Strategist plan or higher.'
    );
  }

  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recCutoff = new Date(now.getTime() - RECENT_REC_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Parallel data fetch
  const [competitorsResult, changesResult, recsResult] = await Promise.all([
    queryByPK(competitorPK(userId), 'COMP#', { scanForward: true }),
    queryGSI('GSI1', 'GSI1PK', userId, undefined, {
      skName: 'GSI1SK',
      skBetween: skPrefixRange('CHANGE#', weekStart.toISOString()),
      limit: 50,
      scanForward: false,
    }),
    queryByPK(recommendationPK(userId), 'REC#', { scanForward: false, limit: 50 }),
  ]);

  // Phase 23 — weekly briefing PDF is about competitors; exclude self-brand.
  const allRows = competitorsResult.items as unknown as Competitor[];
  const competitors = allRows.filter((c) => c.targetKind !== 'self');
  const selfCompetitorIds = new Set(
    allRows.filter((c) => c.targetKind === 'self').map((c) => c.id)
  );

  const topChanges = changesResult.items
    .filter((c) => !selfCompetitorIds.has(c.competitorId as string))
    .map((c) => {
      const a = (c.aiAnalysis as Record<string, unknown> | undefined) ?? {};
      return {
        competitorName: (c.competitorName as string) ?? '',
        detectedAt: (c.detectedAt as string) ?? '',
        changeType: ((a.changeType as string) ?? 'content'),
        significance: (c.significance as number) ?? 0,
        summary: ((a.summary as string) ?? ''),
        strategicImplication: a.strategicImplication as string | undefined,
      };
    });

  const recommendations = (recsResult.items as unknown as Recommendation[])
    .filter((r) => r.status === 'open' && r.createdAt >= recCutoff)
    .map((r) => ({
      title: r.title,
      body: r.body,
      category: r.category,
      timeHorizon: r.timeHorizon,
      confidence: r.confidence,
    }));

  // Render
  const pdfBuffer = await renderBriefingPdf({
    user: {
      name: user.name,
      companyName: user.companyName,
      industry: user.industry,
    },
    weekRange: { start: weekStart.toISOString(), end: now.toISOString() },
    competitors: competitors.map((c) => ({
      name: c.name,
      url: c.url,
      threatLevel: c.threatLevel,
      threatReasoning: c.threatReasoning,
      momentum: c.momentum,
      derivedTags: c.derivedTags,
    })),
    topChanges,
    recommendations,
  });

  // Upload + presign
  const exportId = generateId();
  const ymd = now.toISOString().slice(0, 10);
  const filename = `rivalscan-briefing-${ymd}.pdf`;
  const bucket = process.env.BUCKET_NAME;
  if (!bucket) throw new HttpError(500, 'CONFIG_ERROR', 'Storage bucket not configured');

  // Path-prefix scoping: the userId comes from JWT claims, so a user can never
  // write to another user's prefix. The Lambda's IAM grant is bucket-wide via
  // `addRoute()` but the API surface only ever hits the requesting user's path.
  const key = `exports/USER#${userId}/${exportId}.pdf`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ContentDisposition: `attachment; filename="${filename}"`,
      Metadata: {
        'export-id': exportId,
        'user-id': userId,
        'generated-at': now.toISOString(),
      },
    })
  );

  const downloadUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: PRESIGNED_TTL_SEC }
  );
  const expiresAt = new Date(Date.now() + PRESIGNED_TTL_SEC * 1000).toISOString();

  logger.info('pdf_export', {
    userId,
    exportId,
    competitorCount: competitors.length,
    changeCount: topChanges.length,
    recommendationCount: recommendations.length,
    pdfBytes: pdfBuffer.byteLength,
    durationMs: Date.now() - startedAt,
  });

  return {
    statusCode: 200,
    body: {
      data: {
        downloadUrl,
        filename,
        expiresAt,
        exportId,
        pdfBytes: pdfBuffer.byteLength,
      },
    },
  };
});
