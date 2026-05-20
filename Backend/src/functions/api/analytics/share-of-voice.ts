/**
 * GET /analytics/share-of-voice?window=7d|30d|90d
 *
 * Phase 24. Returns the workspace's share-of-voice breakdown for the chosen
 * window: each tracked entity (competitors + the self-brand row) appears as a
 * row in the `overall` ranking and per-category rankings, with count + percent.
 *
 * Tier window cap: Scout 7d, Strategist 30d, Command 90d (clamped via
 * `PLAN_LIMITS[plan].historyDays`). Self-brand row is included as `isSelf: true`.
 */

import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryByPK, queryGSI, getItem } from '../../../shared/db/queries';
import { competitorPK, userPK, userSK } from '../../../shared/db/keys';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';
import { computeShareOfVoice, type SoVEntity, type ChangeForSov } from '../../../shared/utils/share-of-voice';
import { PLAN_LIMITS, type User } from '../../../shared/types';

const ALLOWED_WINDOWS = [7, 30, 90] as const;
type AllowedWindow = (typeof ALLOWED_WINDOWS)[number];

function parseWindow(raw: string | undefined): AllowedWindow {
  const map: Record<string, AllowedWindow> = { '7d': 7, '30d': 30, '90d': 90 };
  return map[raw ?? '30d'] ?? 30;
}

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  // Tier-window clamp: never exceed the plan's history cap.
  const requested = parseWindow(event.queryStringParameters?.window);
  const planCap = PLAN_LIMITS[user.plan].historyDays;
  const windowDays = Math.min(requested, planCap) as AllowedWindow;

  // Load all entities (competitors + self) so percentages span the full
  // workspace. The discriminator from Phase 23 maps cleanly to SoVEntity.isSelf.
  const { items: rows } = await queryByPK(competitorPK(userId), 'COMP#');
  const entities: SoVEntity[] = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    isSelf: r.targetKind === 'self',
  }));

  // Pull the workspace's recent Change records via GSI1 and filter in-memory
  // by detectedAt cutoff. The GSI1 prefix is `CHANGE#` (no date) — the recency
  // filter happens server-side here. Cap at 1000 to bound Lambda memory; if a
  // single workspace ever blows past that we'll revisit.
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const { items: rawChanges } = await queryGSI('GSI1', 'GSI1PK', userId, 'CHANGE#', {
    skName: 'GSI1SK',
    limit: 1000,
    scanForward: false,
  });
  const changes: ChangeForSov[] = rawChanges
    .map((c) => ({
      competitorId: (c.competitorId as string) ?? '',
      sourceCategory: c.sourceCategory as string | undefined,
      detectedAt: (c.detectedAt as string) ?? '',
    }))
    .filter((c) => {
      const ts = Date.parse(c.detectedAt);
      return !isNaN(ts) && ts >= cutoff;
    });

  const result = computeShareOfVoice({ entities, changes, windowDays });

  return {
    statusCode: 200,
    body: { data: result },
  };
});
