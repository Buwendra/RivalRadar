import { queryGSI } from '../../shared/db/queries';
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

/**
 * Step Function Lambda: Aggregate a user's top changes from the past 7 days.
 */
export const handler = async (event: Event): Promise<{ userId: string; email: string; name: string; topChanges: AggregatedChange[] }> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Query all changes for this user in the past 7 days
  const { items } = await queryGSI('GSI1', 'GSI1PK', event.userId, `CHANGE#${sevenDaysAgo}`, {
    skName: 'GSI1SK',
    limit: 50,
    scanForward: false,
  });

  // Map and sort by significance
  const changes: AggregatedChange[] = items
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

  logger.info('AggregateChanges completed', { userId: event.userId, changesFound: changes.length });

  return {
    userId: event.userId,
    email: event.email,
    name: event.name,
    topChanges: changes,
  };
};
