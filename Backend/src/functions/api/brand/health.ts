/**
 * GET /brand/health
 *
 * Phase 24 — Brand Health Score. Returns a composite 0–100 KPI plus per-component
 * breakdown (sentiment / voice / momentum) for the workspace's self-brand row.
 *
 * Gated by `brandPulse` capability. Returns 404 BRAND_NOT_SET_UP if the workspace
 * has not created its self-brand row yet (frontend should hide the widget when
 * brand setup is incomplete).
 */

import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryByPK, queryGSI } from '../../../shared/db/queries';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { computeBrandHealthScore } from '../../../shared/utils/brand-health';
import type { Momentum, ResearchFinding } from '../../../shared/types';
import { loadSelfBrand, loadUserForBrand, assertBrandPulseCapability } from './_shared';

const HEALTH_WINDOW_DAYS = 28; // matches the 4-week window used in the score formula

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
    throw new HttpError(404, 'BRAND_NOT_SET_UP', 'Set up your brand profile to see Brand Health Score.');
  }

  // Parallel: pull self-brand findings (sentiment input), workspace changes
  // (voice input), and the self competitor row's current momentum.
  const [findingsRes, changesRes] = await Promise.all([
    queryByPK(`COMP#${self.id}`, 'RESEARCH#', { limit: 20 }),
    queryGSI('GSI1', 'GSI1PK', userId, 'CHANGE#', {
      skName: 'GSI1SK',
      limit: 1000,
      scanForward: false,
    }),
  ]);

  const cutoffMs = Date.now() - HEALTH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const selfFindings = (findingsRes.items as unknown as ResearchFinding[]).filter((f) => {
    const ts = Date.parse(f.generatedAt);
    return !isNaN(ts) && ts >= cutoffMs;
  });
  const workspaceChanges = changesRes.items
    .map((c) => ({
      competitorId: (c.competitorId as string) ?? '',
      detectedAt: (c.detectedAt as string) ?? '',
    }))
    .filter((c) => {
      const ts = Date.parse(c.detectedAt);
      return !isNaN(ts) && ts >= cutoffMs;
    });

  const momentum = (self.momentum as Momentum | undefined) ?? undefined;

  const score = computeBrandHealthScore({
    selfFindings,
    workspaceChanges,
    selfCompetitorId: self.id,
    momentum,
  });

  return {
    statusCode: 200,
    body: { data: score },
  };
});
