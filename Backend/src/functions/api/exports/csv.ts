/**
 * POST /exports/csv
 *
 * Phase 6a — CSV export of one of {changes, competitors, recommendations}.
 * Strategist+ tier-gated.
 *
 * Returns the CSV inline as a string field on the JSON envelope plus a
 * suggested filename. Frontend creates a Blob and triggers the download.
 * No S3 hop, no presigned URL — for typical accounts the payload is < 100 KB.
 *
 * The PDF equivalent (Phase 6b) will need async S3+presigned because of
 * Puppeteer cold starts; CSV is synchronous + small enough that inline is
 * cleaner. Same JSON envelope is preserved either way.
 */
import { z } from 'zod';
import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { getItem, queryByPK, queryGSI } from '../../../shared/db/queries';
import { userPK, userSK, competitorPK, recommendationPK } from '../../../shared/db/keys';
import { hasCapability } from '../../../shared/utils/capability';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { User, Competitor, Recommendation } from '../../../shared/types';

const exportSchema = z.object({
  type: z.enum(['changes', 'competitors', 'recommendations']),
  /** Optional ISO date — only export rows since this point. Default: 90d ago. */
  since: z.string().datetime().optional(),
});

/**
 * RFC 4180 CSV cell escape: wrap in double quotes if contains comma, quote,
 * newline, or carriage return; escape internal quotes by doubling them.
 */
function csvCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvLine(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(exportSchema, parseBody(event));

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  if (!hasCapability(user, 'csvExports')) {
    throw new HttpError(
      403,
      'PLAN_REQUIRED',
      'CSV exports require the Strategist plan or higher.'
    );
  }

  const since = body.since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const filename = `rivalscan-${body.type}-${today}.csv`;
  let csv = '';
  let rowCount = 0;

  if (body.type === 'changes') {
    // GSI1 is keyed by userId for combined-feed lookup; SK begins_with CHANGE#<since>
    const { items } = await queryGSI('GSI1', 'GSI1PK', userId, `CHANGE#${since}`, {
      skName: 'GSI1SK',
      limit: 1000,
      scanForward: false,
    });
    const rows = items.map((c) => {
      const a = (c.aiAnalysis as Record<string, unknown> | undefined) ?? {};
      return [
        c.detectedAt ?? '',
        c.competitorName ?? '',
        a.changeType ?? '',
        c.significance ?? '',
        a.summary ?? '',
        a.strategicImplication ?? '',
        a.recommendedAction ?? '',
        c.pageUrl ?? '',
      ];
    });
    csv = [
      csvLine([
        'detectedAt',
        'competitor',
        'changeType',
        'significance',
        'summary',
        'strategicImplication',
        'recommendedAction',
        'sourceUrl',
      ]),
      ...rows.map(csvLine),
    ].join('\n');
    rowCount = rows.length;
  } else if (body.type === 'competitors') {
    const { items } = await queryByPK(competitorPK(userId), 'COMP#', { scanForward: true });
    const rows = (items as unknown as Competitor[]).map((c) => [
      c.name,
      c.url,
      c.status,
      c.threatLevel ?? '',
      c.threatReasoning ?? '',
      c.momentum ?? '',
      typeof c.momentumChangePercent === 'number' ? c.momentumChangePercent : '',
      (c.derivedTags ?? []).join('; '),
      c.createdAt,
      c.updatedAt,
    ]);
    csv = [
      csvLine([
        'name',
        'url',
        'status',
        'threatLevel',
        'threatReasoning',
        'momentum',
        'momentumChangePercent',
        'tags',
        'createdAt',
        'updatedAt',
      ]),
      ...rows.map(csvLine),
    ].join('\n');
    rowCount = rows.length;
  } else if (body.type === 'recommendations') {
    const { items } = await queryByPK(recommendationPK(userId), 'REC#', { scanForward: false });
    const rows = (items as unknown as Recommendation[])
      .filter((r) => Date.parse(r.createdAt) >= Date.parse(since))
      .map((r) => [
        r.createdAt,
        r.competitorName ?? '',
        r.category,
        r.title,
        r.body,
        r.effortLevel,
        r.timeHorizon,
        r.confidence,
        r.status,
      ]);
    csv = [
      csvLine([
        'createdAt',
        'competitor',
        'category',
        'title',
        'body',
        'effortLevel',
        'timeHorizon',
        'confidence',
        'status',
      ]),
      ...rows.map(csvLine),
    ].join('\n');
    rowCount = rows.length;
  }

  // BOM for Excel compatibility — without it, accented characters render as mojibake.
  const csvWithBom = '﻿' + csv;

  logger.info('csv_export', {
    userId,
    type: body.type,
    rowCount,
    sinceIso: since,
    sizeBytes: Buffer.byteLength(csvWithBom, 'utf8'),
  });

  return {
    statusCode: 200,
    body: {
      data: {
        csv: csvWithBom,
        filename,
        rowCount,
        type: body.type,
      },
    },
  };
});
