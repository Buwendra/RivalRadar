/**
 * POST /competitors/{id}/battlecard
 *
 * Phase 20 — generate a per-competitor battlecard PDF, upload to S3, mint
 * a public share token, and return the share URL. Strategist+ tier-gated
 * via `pdfExports`.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  apiHandler,
  getUserEmail,
  HttpError,
} from '../../../shared/middleware/handler';
import { getItem, putItem, queryByPK } from '../../../shared/db/queries';
import {
  battlecardPK,
  battlecardSK,
  battlecardTokenGSI3,
  competitorPK,
  competitorSK,
  userPK,
  userSK,
} from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { hasCapability } from '../../../shared/utils/capability';
import { renderBattlecardPdf } from '../../../shared/services/battlecard-pdf';
import { logger } from '../../../shared/utils/logger';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type {
  Battlecard,
  Competitor,
  ResearchFinding,
  User,
} from '../../../shared/types';

const s3 = new S3Client({});
const TTL_DAYS = 30;
const RECENT_CHANGE_LIMIT = 30;

export const handler = apiHandler(async (event) => {
  const startedAt = Date.now();
  const email = getUserEmail(event);
  const competitorId = event.pathParameters?.id;
  if (!competitorId)
    throw new HttpError(400, 'MISSING_ID', 'Competitor ID is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const tenantUserId = ctx.tenantUserId;

  const user = await getItem<User & Record<string, unknown>>(
    userPK(tenantUserId),
    userSK()
  );
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  if (!hasCapability(user, 'pdfExports')) {
    throw new HttpError(
      403,
      'PLAN_REQUIRED',
      'Battlecards require the Strategist plan or higher.'
    );
  }

  const competitor = await getItem<Competitor>(
    competitorPK(tenantUserId),
    competitorSK(competitorId)
  );
  if (!competitor) {
    throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');
  }

  const [{ items: changes }, { items: research }] = await Promise.all([
    queryByPK(`COMP#${competitorId}`, 'CHANGE#', {
      limit: RECENT_CHANGE_LIMIT,
      scanForward: false,
    }),
    queryByPK(`COMP#${competitorId}`, 'RESEARCH#', {
      limit: 1,
      scanForward: false,
    }),
  ]);

  const latestResearch = research[0] as unknown as ResearchFinding | undefined;

  const pdfBuffer = await renderBattlecardPdf({
    competitor: {
      name: competitor.name,
      url: competitor.url,
      threatLevel: competitor.threatLevel,
      threatReasoning: competitor.threatReasoning,
      momentum: competitor.momentum,
      momentumChangePercent: competitor.momentumChangePercent,
      derivedTags: competitor.derivedTags,
      predictedMoves: competitor.predictedMoves,
    },
    recentChanges: changes.map((c) => {
      const a = (c.aiAnalysis as Record<string, unknown> | undefined) ?? {};
      return {
        detectedAt: (c.detectedAt as string) ?? '',
        significance: (c.significance as number) ?? 0,
        changeType: a.changeType as string | undefined,
        summary: a.summary as string | undefined,
        pageUrl: c.pageUrl as string | undefined,
      };
    }),
    derivedState: latestResearch?.derivedState,
    citations: latestResearch?.citations ?? [],
    latestResearchAt: latestResearch?.generatedAt,
    generatedAt: new Date().toISOString(),
    workspaceName: ctx.workspaceName,
  });

  const id = generateId();
  const publicToken = generateId();
  const now = new Date();
  const createdAt = now.toISOString();
  const ymd = createdAt.slice(0, 10);
  const filename = `rivalscan-battlecard-${slugify(competitor.name)}-${ymd}.pdf`;

  const bucket = process.env.BUCKET_NAME;
  if (!bucket)
    throw new HttpError(500, 'CONFIG_ERROR', 'Storage bucket not configured');

  const s3Key = `battlecards/USER#${tenantUserId}/${id}.pdf`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ContentDisposition: `inline; filename="${filename}"`,
      Metadata: {
        'battlecard-id': id,
        'competitor-id': competitorId,
        'tenant-user-id': tenantUserId,
        'generated-at': createdAt,
      },
    })
  );

  const expiresAt = Math.floor(now.getTime() / 1000) + TTL_DAYS * 24 * 60 * 60;
  const tokenKeys = battlecardTokenGSI3(publicToken);
  const row: Battlecard & Record<string, unknown> = {
    id,
    competitorId,
    competitorName: competitor.name,
    tenantUserId,
    createdByUserId: ctx.callerUserId,
    createdByEmail: ctx.callerEmail,
    publicToken,
    s3Key,
    filename,
    pdfBytes: pdfBuffer.byteLength,
    expiresAt,
    createdAt,
  };

  await putItem({
    PK: battlecardPK(tenantUserId),
    SK: battlecardSK(createdAt, id),
    ...row,
    ...tokenKeys,
  });

  // API Gateway HTTP API v2 always populates `domainName` on the request
  // context; fall back to env var for local-test events.
  const apiHost =
    event.requestContext.domainName ?? process.env.API_PUBLIC_HOST ?? '';
  const shareUrl = apiHost
    ? `https://${apiHost}/public/battlecards/${publicToken}`
    : `/public/battlecards/${publicToken}`;

  logger.info('battlecard_generated', {
    battlecardId: id,
    competitorId,
    tenantUserId,
    callerUserId: ctx.callerUserId,
    pdfBytes: pdfBuffer.byteLength,
    durationMs: Date.now() - startedAt,
  });

  return {
    statusCode: 200,
    body: {
      data: {
        id,
        competitorId,
        competitorName: competitor.name,
        publicToken,
        shareUrl,
        filename,
        pdfBytes: pdfBuffer.byteLength,
        expiresAt,
        createdAt,
      },
    },
  };
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'competitor';
}
