/**
 * Scheduled Lambda — runs monthly (1st of each month, 8am UTC) to email a
 * PDF briefing link to every Command-tier user who has opted in to monthly
 * reports.
 *
 * Sequence:
 *   1. Scan the user table for `plan = command AND scheduledReports.monthly =
 *      true AND onboardingComplete = true`.
 *   2. Skip users whose `lastScheduledReportAt` falls within the current month
 *      (idempotency on cron retry).
 *   3. For each eligible user, query their data (last 30 days), render the
 *      PDF via the same renderBriefingPdf used by the on-demand export,
 *      upload to S3 under `exports/USER#<id>/scheduled-<YYYY-MM>.pdf`,
 *      generate a 30-day presigned URL, and email it.
 *   4. Stamp `lastScheduledReportAt` after a successful send.
 *
 * Best-effort per user — one user's failure does not block the others. The
 * Lambda iterates synchronously to bound concurrent S3 + SES calls; at MVP
 * scale (<200 Command users) this completes well within the 5-minute budget.
 *
 * For larger scale (Phase 8+), split into a fan-out: this Lambda enqueues
 * SQS messages, a per-user worker generates + sends one report.
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ddb, TABLE_NAME } from '../../shared/db/client';
import { queryByPK, queryGSI, skPrefixRange, updateItem } from '../../shared/db/queries';
import {
  userPK,
  userSK,
  competitorPK,
  recommendationPK,
} from '../../shared/db/keys';
import { generateId } from '../../shared/utils/id';
import { hasCapability } from '../../shared/utils/capability';
import { renderBriefingPdf } from '../../shared/utils/pdf-renderer';
import { sendEmail } from '../../shared/services/ses';
import { logger } from '../../shared/utils/logger';
import type { User, Competitor, Recommendation } from '../../shared/types';

const s3 = new S3Client({});

const PRESIGNED_TTL_SEC = 30 * 24 * 60 * 60; // 30 days
const REPORT_WINDOW_DAYS = 30; // monthly = 30 days of changes
const RECENT_REC_DAYS = 30;

interface EligibleUser {
  userId: string;
  email: string;
  name: string;
  companyName?: string;
  industry?: string;
}

interface ReportResult {
  scanned: number;
  eligible: number;
  skipped: number;
  sent: number;
  failed: number;
  month: string;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

async function findEligibleUsers(month: string): Promise<EligibleUser[]> {
  const eligible: EligibleUser[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          'SK = :sk AND onboardingComplete = :oc AND #plan = :plan AND scheduledReports.monthly = :true',
        ExpressionAttributeNames: { '#plan': 'plan' },
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
          ':oc': true,
          ':plan': 'command',
          ':true': true,
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of (result.Items ?? []) as Array<User & Record<string, unknown>>) {
      // Defense in depth — capability check at runtime in case the field
      // somehow lingers on a downgraded user.
      if (!hasCapability(item, 'scheduledReports')) continue;
      const last = (item.lastScheduledReportAt as string | undefined) ?? '';
      if (last.slice(0, 7) === month) continue; // already sent this month
      eligible.push({
        userId: item.id,
        email: item.email,
        name: item.name,
        companyName: item.companyName,
        industry: item.industry,
      });
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return eligible;
}

async function generateAndSendForUser(
  user: EligibleUser,
  bucket: string,
  month: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recCutoff = new Date(now.getTime() - RECENT_REC_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [competitorsResult, changesResult, recsResult] = await Promise.all([
      queryByPK(competitorPK(user.userId), 'COMP#', { scanForward: true }),
      queryGSI('GSI1', 'GSI1PK', user.userId, undefined, {
        skName: 'GSI1SK',
        skBetween: skPrefixRange('CHANGE#', windowStart.toISOString()),
        limit: 100,
        scanForward: false,
      }),
      queryByPK(recommendationPK(user.userId), 'REC#', {
        scanForward: false,
        limit: 50,
      }),
    ]);

    // Phase 23 — scheduled reports are competitor-focused; exclude self-brand.
    const competitors = (competitorsResult.items as unknown as Competitor[]).filter(
      (c) => c.targetKind !== 'self'
    );
    const topChanges = changesResult.items.map((c) => {
      const a = (c.aiAnalysis as Record<string, unknown> | undefined) ?? {};
      return {
        competitorName: (c.competitorName as string) ?? '',
        detectedAt: (c.detectedAt as string) ?? '',
        changeType: (a.changeType as string) ?? 'content',
        significance: (c.significance as number) ?? 0,
        summary: (a.summary as string) ?? '',
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

    const pdfBuffer = await renderBriefingPdf({
      user: {
        name: user.name,
        companyName: user.companyName,
        industry: user.industry,
      },
      weekRange: { start: windowStart.toISOString(), end: now.toISOString() },
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

    const exportId = generateId();
    const ymd = now.toISOString().slice(0, 10);
    const filename = `rivalscan-monthly-${ymd}.pdf`;
    const key = `exports/USER#${user.userId}/scheduled-${month}-${exportId}.pdf`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ContentDisposition: `attachment; filename="${filename}"`,
        Metadata: {
          'export-id': exportId,
          'user-id': user.userId,
          'scheduled-month': month,
          'generated-at': now.toISOString(),
        },
      })
    );

    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: PRESIGNED_TTL_SEC }
    );

    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">RivalScan</h1>
          <p style="color: #93c5fd; margin: 4px 0 0;">Your monthly executive briefing — ${monthLabel}</p>
        </div>
        <div style="padding: 24px 32px;">
          <p>Hi ${user.name},</p>
          <p>Your ${monthLabel} competitive briefing is ready. It covers the past 30 days of competitor activity, recommendations, and threat-ranked portfolio status.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${downloadUrl}" style="background: #2563eb; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
              Download PDF briefing
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            ${competitors.length} competitor${competitors.length === 1 ? '' : 's'} ·
            ${topChanges.length} change${topChanges.length === 1 ? '' : 's'} this month ·
            ${recommendations.length} active recommendation${recommendations.length === 1 ? '' : 's'}
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            The download link expires in 30 days. You can disable monthly briefings any time in your dashboard settings.
          </p>
        </div>
        <div style="background: #f9fafb; padding: 16px 32px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0; line-height: 1.5;">
            AI-generated analysis. May contain errors. For internal evaluation only — not legal, financial, or investment advice.
          </p>
        </div>
      </div>
    `;

    await sendEmail(user.email, `Your monthly competitive briefing — ${monthLabel}`, html);

    await updateItem(userPK(user.userId), userSK(), {
      lastScheduledReportAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    logger.info('scheduled_report_sent', {
      userId: user.userId,
      month,
      exportId,
      pdfBytes: pdfBuffer.byteLength,
      competitorCount: competitors.length,
      changeCount: topChanges.length,
      recommendationCount: recommendations.length,
    });

    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('scheduled_report_failed', { userId: user.userId, month, error });
    return { ok: false, error };
  }
}

export const handler = async (): Promise<ReportResult> => {
  const bucket = process.env.BUCKET_NAME;
  if (!bucket) throw new Error('BUCKET_NAME env var is required');

  const month = currentMonth();
  logger.info('send-scheduled-reports started', { month });

  const eligible = await findEligibleUsers(month);
  const result: ReportResult = {
    scanned: -1, // not tracked separately for now
    eligible: eligible.length,
    skipped: 0,
    sent: 0,
    failed: 0,
    month,
  };

  for (const user of eligible) {
    const r = await generateAndSendForUser(user, bucket, month);
    if (r.ok) result.sent += 1;
    else result.failed += 1;
  }

  logger.info('send-scheduled-reports completed', { ...result });
  return result;
};
