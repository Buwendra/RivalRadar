import { generateWeeklySummary } from '../../shared/services/anthropic';
import { logger } from '../../shared/utils/logger';

interface AggregatedChange {
  competitorName: string;
  pageUrl: string;
  summary: string;
  significanceScore: number;
  changeType: string;
  detectedAt: string;
}

interface Event {
  userId: string;
  email: string;
  name: string;
  topChanges: AggregatedChange[];
}

/**
 * Step Function Lambda: Generate weekly strategic summary using Claude Sonnet.
 */
export const handler = async (event: Event): Promise<Event & { strategicSummary: string }> => {
  if (event.topChanges.length === 0) {
    return {
      ...event,
      strategicSummary: 'No significant competitor changes were detected this week. Your competitive landscape appears stable.',
    };
  }

  const summary = await generateWeeklySummary(event.topChanges);

  logger.info('GenerateSummary completed', { userId: event.userId, changesAnalyzed: event.topChanges.length });

  return { ...event, strategicSummary: summary };
};
