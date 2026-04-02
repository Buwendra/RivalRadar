import { queryGSI, queryByPK } from '../../shared/db/queries';
import { logger } from '../../shared/utils/logger';

interface Event {
  competitorIds?: string[];
  userId?: string;
}

interface CompetitorInfo {
  compId: string;
  userId: string;
  name: string;
  url: string;
  pagesToTrack: string[];
}

/**
 * Step Function Lambda: Get all active competitors to scrape.
 * If competitorIds are provided (manual/onboarding), use those.
 * Otherwise, query GSI2 for all active competitors.
 */
export const handler = async (event: Event): Promise<{ competitors: CompetitorInfo[] }> => {
  logger.info('GetCompetitors started', { event });

  if (event.competitorIds && event.userId) {
    // Manual scrape — fetch specific competitors
    const competitors: CompetitorInfo[] = [];
    for (const compId of event.competitorIds) {
      const { items } = await queryByPK(`USER#${event.userId}`, `COMP#${compId}`, { limit: 1 });
      if (items.length > 0) {
        const item = items[0];
        competitors.push({
          compId: item.id as string,
          userId: item.userId as string,
          name: item.name as string,
          url: item.url as string,
          pagesToTrack: item.pagesToTrack as string[],
        });
      }
    }
    return { competitors };
  }

  // Daily cron — get all active competitors via GSI2
  const allCompetitors: CompetitorInfo[] = [];
  let cursor: string | undefined;

  do {
    const result = await queryGSI('GSI2', 'GSI2PK', 'ACTIVE', 'COMP#', {
      skName: 'GSI2SK',
      limit: 100,
      cursor,
    });

    for (const item of result.items) {
      allCompetitors.push({
        compId: item.id as string,
        userId: item.userId as string,
        name: item.name as string,
        url: item.url as string,
        pagesToTrack: item.pagesToTrack as string[],
      });
    }
    cursor = result.cursor;
  } while (cursor);

  logger.info('GetCompetitors completed', { count: allCompetitors.length });
  return { competitors: allCompetitors };
};
