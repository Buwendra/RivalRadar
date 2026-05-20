/**
 * GET /brand
 *
 * Phase 23 — Brand Pulse. Returns the workspace's self-brand snapshot:
 * profile fields + enrichment (momentum, derived tags) + most recent research
 * finding + 30 days of coverage changes.
 *
 * Returns `{ data: null, meta: { needsSetup: true } }` when the workspace has
 * no self-brand row yet (legacy user pre-Phase-23). The frontend uses this
 * sentinel to show the setup CTA modal.
 */

import { apiHandler, getUserEmail } from '../../../shared/middleware/handler';
import { queryByPK } from '../../../shared/db/queries';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { computeMomentum, buildChangesByDay } from '../../../shared/utils/competitor-metrics';
import { loadSelfBrand, loadUserForBrand, assertBrandPulseCapability } from './_shared';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await loadUserForBrand(userId);
  assertBrandPulseCapability(user);

  const self = await loadSelfBrand(userId);
  if (!self) {
    // `data: null` is the "needs setup" sentinel — the frontend renders the
    // setup CTA modal when this is observed. `hasMore` keeps the PaginationMeta
    // shape happy even though pagination doesn't apply here.
    return {
      statusCode: 200,
      body: {
        data: null,
        meta: { hasMore: false },
      },
    };
  }

  // Pull 30d of coverage changes + the most recent research finding.
  const [{ items: changes }, { items: research }] = await Promise.all([
    queryByPK(`COMP#${self.id}`, 'CHANGE#', { limit: 100 }),
    queryByPK(`COMP#${self.id}`, 'RESEARCH#', { limit: 1 }),
  ]);

  const timestamps = changes
    .map((c) => c.detectedAt as string | undefined)
    .filter((t): t is string => typeof t === 'string');
  const changesByDay = buildChangesByDay(timestamps, new Date());
  const { momentum, momentumChangePercent } = computeMomentum({ changesByDay });

  const latestResearch = research[0]
    ? {
        id: research[0].id as string,
        generatedAt: research[0].generatedAt as string,
        summary: research[0].summary as string,
        categories: research[0].categories,
        citations: research[0].citations,
        searchQueries: research[0].searchQueries,
        derivedState: research[0].derivedState,
      }
    : null;

  return {
    statusCode: 200,
    body: {
      data: {
        id: self.id,
        name: self.name,
        url: self.url,
        industry: self.industry,
        momentum,
        momentumChangePercent,
        momentumAsOf: self.momentumAsOf,
        derivedTags: (self.derivedTags as string[] | undefined) ?? [],
        derivedTagsAsOf: self.derivedTagsAsOf,
        latestResearch,
        changesByDay,
        recentChanges: changes.slice(0, 30).map((c) => ({
          id: c.id as string,
          significance: c.significance as number,
          pageUrl: c.pageUrl as string,
          aiAnalysis: c.aiAnalysis,
          detectedAt: c.detectedAt as string,
          sourceCategory: c.sourceCategory as string | undefined,
        })),
      },
    },
  };
});
