import { queryGSI, queryByPK } from '../../shared/db/queries';
import { competitorPK } from '../../shared/db/keys';
import { logger } from '../../shared/utils/logger';

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
  // (with current enrichment fields for cross-portfolio context).
  const [changesResult, competitorsResult] = await Promise.all([
    queryGSI('GSI1', 'GSI1PK', event.userId, `CHANGE#${sevenDaysAgo}`, {
      skName: 'GSI1SK',
      limit: 50,
      scanForward: false,
    }),
    queryByPK(competitorPK(event.userId), 'COMP#', { scanForward: true }),
  ]);

  // Map and sort changes by significance
  const changes: AggregatedChange[] = changesResult.items
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
    .sort((a, b) => b.significanceScore - a.significanceScore)
    .slice(0, 10); // Top 10 for the summary

  // Compact projection of each competitor's current portfolio state. Only
  // include competitors that have been enriched at least once (have momentum
  // or threat) so the digest doesn't include stale "unscored" placeholders.
  const competitorSnapshots: CompetitorSnapshot[] = competitorsResult.items
    .filter((c) => c.momentum || c.threatLevel || c.derivedTags)
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
