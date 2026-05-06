import { getItem, queryGSI, queryByPK } from '../../shared/db/queries';
import { competitorPK, userPK, userSK } from '../../shared/db/keys';
import { logger } from '../../shared/utils/logger';
import { isSnoozed } from '../../shared/utils/snooze';
import type { User } from '../../shared/types';

interface Event {
  userId: string;
  email: string;
  name: string;
}

interface AggregatedChange {
  competitorName: string;
  pageUrl: string;
  summary: string;
  significanceScore: number;
  changeType: string;
  detectedAt: string;
}

interface CompetitorSnapshot {
  name: string;
  momentum?: string;
  threatLevel?: string;
  topTags?: string[];
  stage?: string;
}

/**
 * Step Function Lambda: Aggregate a user's top changes from the past 7 days,
 * plus a portfolio snapshot of all their competitors' current state for the
 * weekly digest's cross-competitor framing.
 */
export const handler = async (
  event: Event
): Promise<{
  userId: string;
  email: string;
  name: string;
  topChanges: AggregatedChange[];
  competitorSnapshots: CompetitorSnapshot[];
}> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Query in parallel: user's top changes (last 7d) + all of their competitors
  // (with current enrichment fields for cross-portfolio context) + user record
  // (for the Phase 7b feed threshold).
  const [changesResult, competitorsResult, tenantUser] = await Promise.all([
    queryGSI('GSI1', 'GSI1PK', event.userId, `CHANGE#${sevenDaysAgo}`, {
      skName: 'GSI1SK',
      limit: 50,
      scanForward: false,
    }),
    queryByPK(competitorPK(event.userId), 'COMP#', { scanForward: true }),
    getItem<User & Record<string, unknown>>(userPK(event.userId), userSK()),
  ]);

  const feedThreshold = tenantUser?.feedSignificanceThreshold ?? 0;

  // Build a snooze map by competitor name so we can drop changes from
  // currently-snoozed competitors before they leak into the digest. Keying
  // by name (not id) because aggregated changes have only the denormalized
  // competitorName field. Names are unique within a user's portfolio at
  // create-time so collisions are not a concern.
  const snoozedNames = new Set(
    competitorsResult.items
      .filter((c) => isSnoozed(c as { snoozedUntil?: string }))
      .map((c) => c.name as string)
  );

  // Map, filter, and sort: drop snoozed competitors, drop changes below the
  // workspace's feed threshold (Phase 7b), then top-10 by significance.
  const changes: AggregatedChange[] = changesResult.items
    .filter((item) => !snoozedNames.has(item.competitorName as string))
    .map((item) => {
      const analysis = item.aiAnalysis as Record<string, unknown>;
      return {
        competitorName: item.competitorName as string,
        pageUrl: item.pageUrl as string,
        summary: (analysis?.summary as string) ?? '',
        significanceScore: (analysis?.significanceScore as number) ?? 0,
        changeType: (analysis?.changeType as string) ?? 'content',
        detectedAt: item.detectedAt as string,
      };
    })
    .filter((c) => c.significanceScore >= feedThreshold)
    .sort((a, b) => b.significanceScore - a.significanceScore)
    .slice(0, 10); // Top 10 for the summary

  // Compact projection of each competitor's current portfolio state. Only
  // include competitors that have been enriched at least once (have momentum
  // or threat) so the digest doesn't include stale "unscored" placeholders.
  // Snoozed competitors are also excluded — the user explicitly asked us
  // not to surface them.
  const competitorSnapshots: CompetitorSnapshot[] = competitorsResult.items
    .filter((c) => (c.momentum || c.threatLevel || c.derivedTags) && !isSnoozed(c as { snoozedUntil?: string }))
    .map((c) => {
      const derivedState = c.derivedState as { stage?: string } | undefined;
      const tags = (c.derivedTags as string[] | undefined) ?? [];
      return {
        name: c.name as string,
        momentum: c.momentum as string | undefined,
        threatLevel: c.threatLevel as string | undefined,
        topTags: tags.slice(0, 4),
        stage: derivedState?.stage,
      };
    });

  logger.info('AggregateChanges completed', {
    userId: event.userId,
    changesFound: changes.length,
    competitorSnapshotsCount: competitorSnapshots.length,
  });

  return {
    userId: event.userId,
    email: event.email,
    name: event.name,
    topChanges: changes,
    competitorSnapshots,
  };
};
