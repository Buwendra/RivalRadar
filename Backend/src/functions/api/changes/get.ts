import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { getItem, queryGSI } from '../../../shared/db/queries';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

/**
 * GET /changes/{id}
 *
 * Resolution order:
 *   1. GSI3 `CHANGE_ID#<id>` → base-table getItem (two-hop; GSI3 is
 *      KEYS_ONLY). Every Change written since the GSI3 keys were added
 *      resolves in O(1) regardless of age.
 *   2. Legacy fallback: paginate the tenant's GSI1 change feed. Old rows
 *      predate the GSI3 keys; the previous single-page find() 404'd any
 *      change older than the newest 100 — permalinks broke within weeks of
 *      real usage. Page cap bounds the worst case.
 *
 * Tenancy: the GSI3 path re-checks `userId === ctx.tenantUserId` on the
 * loaded row (GSI3 is keyed by change id alone); the fallback queries only
 * the tenant's own GSI1 partition.
 */

const LEGACY_PAGE_LIMIT = 100;
const LEGACY_MAX_PAGES = 10;

type ChangeRow = Record<string, unknown>;

async function findByGsi3(changeId: string, tenantUserId: string): Promise<ChangeRow | null> {
  const { items } = await queryGSI('GSI3', 'GSI3PK', `CHANGE_ID#${changeId}`, undefined, {
    limit: 1,
  });
  const key = items[0];
  if (!key?.PK || !key.SK) return null;

  const row = await getItem<ChangeRow>(key.PK as string, key.SK as string);
  if (!row || row.userId !== tenantUserId) return null;
  return row;
}

async function findByLegacyScan(
  changeId: string,
  tenantUserId: string
): Promise<ChangeRow | null> {
  let cursor: string | undefined;
  for (let page = 0; page < LEGACY_MAX_PAGES; page++) {
    const result = await queryGSI('GSI1', 'GSI1PK', tenantUserId, 'CHANGE#', {
      skName: 'GSI1SK',
      limit: LEGACY_PAGE_LIMIT,
      cursor,
    });
    const hit = result.items.find((item) => item.id === changeId);
    if (hit) return hit;
    if (!result.cursor) return null;
    cursor = result.cursor;
  }
  return null;
}

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const changeId = event.pathParameters?.id;

  if (!changeId) throw new HttpError(400, 'MISSING_ID', 'Change ID is required');

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const change =
    (await findByGsi3(changeId, userId)) ?? (await findByLegacyScan(changeId, userId));
  if (!change) {
    throw new HttpError(404, 'NOT_FOUND', 'Change not found');
  }

  return {
    statusCode: 200,
    body: {
      data: {
        id: change.id,
        competitorId: change.competitorId,
        competitorName: change.competitorName,
        pageUrl: change.pageUrl,
        diffSummary: change.diffSummary,
        significance: change.significance,
        aiAnalysis: change.aiAnalysis,
        feedbackHelpful: change.feedbackHelpful,
        detectedAt: change.detectedAt,
        sourceCategory: change.sourceCategory,
        citations: change.citations ?? [],
      },
    },
  };
});
