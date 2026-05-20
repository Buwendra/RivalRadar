/**
 * GET /search?q=...&types=changes,competitors,recommendations&limit=20
 *
 * Phase 7b — cross-resource scan-based search. Tolerates 2-3s p95 at <10k
 * records per type per workspace. Migrates to OpenSearch when storage > 50k
 * (out of scope here).
 *
 * Resolution: 3 parallel queries (Changes via GSI1, Recommendations + Competitors
 * via PK), case-insensitive regex match in memory, ranked by significance +
 * exact-title bonus + recency.
 *
 * ResearchFinding bodies are excluded — their dense JSON produces too many
 * false positives. Findings can join later if users explicitly ask.
 */

import { z } from 'zod';
import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryByPK, queryGSI } from '../../../shared/db/queries';
import {
  competitorPK,
  recommendationPK,
} from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

const PER_TYPE_SCAN_CAP = 1000;
const SNIPPET_RADIUS = 60;

const searchSchema = z.object({
  q: z.string().min(2).max(100),
  types: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(50, Math.max(1, Number(v) || 20)) : 20)),
});

type ResultType = 'change' | 'recommendation' | 'competitor';

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  snippet: string;
  matchedField: string;
  score: number;
  createdAt: string;
  competitorId?: string;
  competitorName?: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSnippet(haystack: string, needle: RegExp): string {
  const m = needle.exec(haystack);
  if (!m) return haystack.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, m.index - SNIPPET_RADIUS);
  const end = Math.min(haystack.length, m.index + m[0].length + SNIPPET_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < haystack.length ? '…' : '';
  return prefix + haystack.slice(start, end) + suffix;
}

function recencyBoost(iso: string | undefined): number {
  if (!iso) return 0;
  const ageDays = (Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000);
  if (Number.isNaN(ageDays)) return 0;
  // 30-day half-life: 1.0 today, 0.5 at 30 days, 0.25 at 60.
  return Math.max(0, Math.exp(-ageDays / 43.28));
}

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const params = validate(searchSchema, event.queryStringParameters ?? {});

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const requestedTypes = (params.types ?? 'changes,recommendations,competitors')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const wantChanges = requestedTypes.includes('changes');
  const wantRecs = requestedTypes.includes('recommendations');
  const wantCompetitors = requestedTypes.includes('competitors');

  const needle = new RegExp(escapeRegex(params.q), 'i');

  const [changesRes, recsRes, compsRes] = await Promise.all([
    wantChanges
      ? queryGSI('GSI1', 'GSI1PK', userId, 'CHANGE#', {
          skName: 'GSI1SK',
          limit: PER_TYPE_SCAN_CAP,
          scanForward: false,
        })
      : Promise.resolve({ items: [] as Record<string, unknown>[] }),
    wantRecs
      ? queryByPK(recommendationPK(userId), 'REC#', {
          scanForward: false,
          limit: PER_TYPE_SCAN_CAP,
        })
      : Promise.resolve({ items: [] as Record<string, unknown>[] }),
    wantCompetitors
      ? queryByPK(competitorPK(userId), 'COMP#', {
          scanForward: true,
          limit: PER_TYPE_SCAN_CAP,
        })
      : Promise.resolve({ items: [] as Record<string, unknown>[] }),
  ]);

  const results: SearchResult[] = [];

  for (const item of changesRes.items) {
    const ai = (item.aiAnalysis as Record<string, unknown> | undefined) ?? {};
    const fields: Array<[string, string]> = [
      ['summary', String(ai.summary ?? '')],
      ['strategicImplication', String(ai.strategicImplication ?? '')],
      ['recommendedAction', String(ai.recommendedAction ?? '')],
      ['competitorName', String(item.competitorName ?? '')],
    ];
    const hit = fields.find(([, v]) => v && needle.test(v));
    if (!hit) continue;
    const significance = (item.significance as number) ?? 0;
    const recency = recencyBoost(item.detectedAt as string | undefined);
    const score = significance + recency * 5;
    results.push({
      type: 'change',
      id: String(item.id ?? ''),
      title: String(ai.summary ?? item.competitorName ?? 'Change'),
      snippet: buildSnippet(hit[1], needle),
      matchedField: hit[0],
      score,
      createdAt: String(item.detectedAt ?? ''),
      competitorId: String(item.competitorId ?? ''),
      competitorName: String(item.competitorName ?? ''),
    });
  }

  for (const item of recsRes.items) {
    const fields: Array<[string, string]> = [
      ['title', String(item.title ?? '')],
      ['body', String(item.body ?? '')],
      ['competitorName', String(item.competitorName ?? '')],
    ];
    const hit = fields.find(([, v]) => v && needle.test(v));
    if (!hit) continue;
    const titleMatch = needle.test(String(item.title ?? '')) ? 3 : 0;
    const recency = recencyBoost(item.createdAt as string | undefined);
    const confidence = (item.confidence as number) ?? 0.5;
    const score = confidence * 5 + titleMatch + recency * 3;
    results.push({
      type: 'recommendation',
      id: String(item.id ?? ''),
      title: String(item.title ?? 'Recommendation'),
      snippet: buildSnippet(hit[1], needle),
      matchedField: hit[0],
      score,
      createdAt: String(item.createdAt ?? ''),
      competitorName: item.competitorName ? String(item.competitorName) : undefined,
    });
  }

  for (const item of compsRes.items) {
    // Phase 23 — search results expose competitors only; the self-brand row
    // has its own surface at /dashboard/your-brand.
    if (item.targetKind === 'self') continue;
    const tags = Array.isArray(item.derivedTags) ? (item.derivedTags as string[]).join(' ') : '';
    const fields: Array<[string, string]> = [
      ['name', String(item.name ?? '')],
      ['threatReasoning', String(item.threatReasoning ?? '')],
      ['derivedTags', tags],
      ['url', String(item.url ?? '')],
    ];
    const hit = fields.find(([, v]) => v && needle.test(v));
    if (!hit) continue;
    const nameMatch = needle.test(String(item.name ?? '')) ? 4 : 0;
    const score = 2 + nameMatch;
    results.push({
      type: 'competitor',
      id: String(item.id ?? ''),
      title: String(item.name ?? 'Competitor'),
      snippet: buildSnippet(hit[1], needle),
      matchedField: hit[0],
      score,
      createdAt: String(item.createdAt ?? ''),
      competitorId: String(item.id ?? ''),
      competitorName: String(item.name ?? ''),
    });
  }

  results.sort((a, b) => b.score - a.score);
  const limited = results.slice(0, params.limit);
  const totalScanned =
    changesRes.items.length + recsRes.items.length + compsRes.items.length;
  const truncated =
    changesRes.items.length === PER_TYPE_SCAN_CAP ||
    recsRes.items.length === PER_TYPE_SCAN_CAP ||
    compsRes.items.length === PER_TYPE_SCAN_CAP;

  logger.info('search_executed', {
    tenantUserId: userId,
    callerUserId: ctx.callerUserId,
    qLength: params.q.length,
    hits: limited.length,
    totalScanned,
    truncated,
  });

  return {
    statusCode: 200,
    body: {
      data: {
        results: limited,
        totalScanned,
        truncated,
      },
    },
  };
});
