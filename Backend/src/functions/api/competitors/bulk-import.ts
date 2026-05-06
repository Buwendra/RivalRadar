/**
 * POST /competitors/bulk-import
 *
 * Phase 12 — bulk import competitors from a pasted CSV. Same validation +
 * eligibility surface as the single-create handler, but lets agencies /
 * teams onboard a portfolio in one shot.
 *
 * CSV shape:
 *   name,url,pagesToTrack
 *   Acme,https://acme.example,pricing;features
 *   Globex,https://globex.example,
 *
 * - Header row required (case-insensitive).
 * - `pagesToTrack` cell is semicolon-separated; empty cell defaults to
 *   ['homepage','pricing','features'].
 * - RFC 4180 quoting (escape internal quotes by doubling).
 *
 * Skip-or-fail policy via `skipIneligible`:
 *   false (default) — any per-row error rejects the whole batch.
 *   true            — invalid rows are dropped; valid rows still create.
 */

import { z } from 'zod';
import {
  apiHandler,
  getUserEmail,
  parseBody,
  HttpError,
} from '../../../shared/middleware/handler';
import { putItem, queryByPK, getItem } from '../../../shared/db/queries';
import {
  userPK,
  userSK,
  competitorPK,
  competitorSK,
  gsi2ActiveCompetitorKeys,
} from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { logger } from '../../../shared/utils/logger';
import { PLAN_LIMITS } from '../../../shared/types';
import { validate, competitorCreateSchema } from '../../../shared/middleware/validation';
import { enforceResearchEligibility } from '../../../shared/utils/research-eligibility';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import type { User } from '../../../shared/types';

const DEFAULT_PAGES = ['homepage', 'pricing', 'features'] as const;
type PageType = z.infer<typeof competitorCreateSchema>['pagesToTrack'][number];

const bulkImportSchema = z.object({
  csv: z.string().min(1).max(200_000),
  skipIneligible: z.boolean().optional().default(false),
});

interface ParsedRow {
  rowNumber: number; // 1-based, matches a spreadsheet's row indicator (header is row 1)
  name?: string;
  url?: string;
  pagesToTrack?: string[];
  parseError?: string;
}

/**
 * RFC 4180 CSV parser. Handles quoted fields with embedded commas + newlines
 * + doubled-quote escapes. Mirrors the `csvCell` shape used by exports/csv.ts
 * but in the inverse direction.
 */
function parseCsv(csv: string): string[][] {
  // Strip BOM if present (Excel / Numbers exports often include it).
  let i = 0;
  if (csv.charCodeAt(0) === 0xfeff) i = 1;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  while (i < csv.length) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      // Skip CR; handle line break on the LF (CRLF normalized to LF).
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush the final field/row if there's no trailing newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty trailing rows (common when CSV ends with \n).
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === '')) {
    rows.pop();
  }
  return rows;
}

function indexOfHeader(header: string[], name: string): number {
  return header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
}

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(bulkImportSchema, parseBody(event));

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  // Parse CSV
  const rows = parseCsv(body.csv);
  if (rows.length < 2) {
    throw new HttpError(
      400,
      'CSV_EMPTY',
      'CSV must include a header row plus at least one data row.'
    );
  }
  const header = rows[0];
  const nameIdx = indexOfHeader(header, 'name');
  const urlIdx = indexOfHeader(header, 'url');
  const pagesIdx = indexOfHeader(header, 'pagesToTrack');
  if (nameIdx < 0 || urlIdx < 0) {
    throw new HttpError(
      400,
      'CSV_BAD_HEADER',
      'CSV must have "name" and "url" columns. Optional: "pagesToTrack".'
    );
  }

  // Pre-validate rows (no DB writes yet)
  const parsed: ParsedRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rowNumber = r + 1; // 1-based, header = row 1
    if (cells.every((c) => c.trim() === '')) continue; // skip blank line
    const name = (cells[nameIdx] ?? '').trim();
    const url = (cells[urlIdx] ?? '').trim();
    const pagesRaw = pagesIdx >= 0 ? (cells[pagesIdx] ?? '').trim() : '';
    const pagesToTrack = pagesRaw
      ? pagesRaw
          .split(';')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [...DEFAULT_PAGES];
    parsed.push({ rowNumber, name, url, pagesToTrack });
  }

  // Validate each row against the create schema
  const valid: Array<{ rowNumber: number; name: string; url: string; pagesToTrack: PageType[] }> = [];
  const errors: Array<{ rowNumber: number; reason: string }> = [];
  for (const row of parsed) {
    const result = competitorCreateSchema.safeParse({
      name: row.name,
      url: row.url,
      pagesToTrack: row.pagesToTrack,
    });
    if (!result.success) {
      const reason = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`)
        .join('; ');
      errors.push({ rowNumber: row.rowNumber, reason });
      continue;
    }
    valid.push({ rowNumber: row.rowNumber, ...result.data });
  }

  if (errors.length > 0 && !body.skipIneligible) {
    throw new HttpError(
      400,
      'CSV_ROW_ERRORS',
      `${errors.length} row(s) failed validation. Fix and resubmit, or pass skipIneligible=true.`,
      Object.fromEntries(errors.map((e) => [`row${e.rowNumber}`, e.reason]))
    );
  }

  if (valid.length === 0) {
    throw new HttpError(400, 'NO_VALID_ROWS', 'No valid rows to import.');
  }

  // Plan-limit gate: existing + valid <= maxCompetitors
  const { items: existing } = await queryByPK(competitorPK(userId), 'COMP#');
  const maxCompetitors = PLAN_LIMITS[user.plan].maxCompetitors;
  if (existing.length + valid.length > maxCompetitors) {
    throw new HttpError(
      403,
      'PLAN_LIMIT',
      `Your ${user.plan} plan allows up to ${maxCompetitors} competitors. You currently have ${existing.length} and tried to add ${valid.length}.`
    );
  }

  // Eligibility: rate limit + sanctions + classifier on the WHOLE batch
  const eligibility = await enforceResearchEligibility({
    user,
    competitors: valid.map((v) => ({ name: v.name, url: v.url })),
  });
  if (!eligibility.allowed) {
    const status = eligibility.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 403;
    throw new HttpError(
      status,
      eligibility.code ?? 'NOT_ALLOWED',
      eligibility.reason ?? 'Bulk import not allowed for this batch.'
    );
  }

  // Insert all valid rows in parallel
  const now = new Date().toISOString();
  const created = await Promise.all(
    valid.map(async (v) => {
      const compId = generateId();
      await putItem({
        PK: competitorPK(userId),
        SK: competitorSK(compId),
        id: compId,
        userId,
        name: v.name,
        url: v.url,
        pagesToTrack: v.pagesToTrack,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        ...gsi2ActiveCompetitorKeys(compId),
      });
      return {
        id: compId,
        name: v.name,
        url: v.url,
        pagesToTrack: v.pagesToTrack,
        status: 'active' as const,
        createdAt: now,
        rowNumber: v.rowNumber,
      };
    })
  );

  logger.info('competitors_bulk_imported', {
    userId,
    workspaceId: ctx.workspaceId,
    imported: created.length,
    skipped: errors.length,
  });

  return {
    statusCode: 201,
    body: {
      data: {
        imported: created.length,
        skipped: errors.map((e) => ({ rowNumber: e.rowNumber, reason: e.reason })),
        competitors: created,
      },
    },
  };
});
