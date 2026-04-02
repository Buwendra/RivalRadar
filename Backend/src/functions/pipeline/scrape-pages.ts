import { scrapeUrl } from '../../shared/services/firecrawl';
import { logger } from '../../shared/utils/logger';

interface Event {
  compId: string;
  userId: string;
  name: string;
  url: string;
  pagesToTrack: string[];
}

interface PageResult {
  pageUrl: string;
  markdown: string;
  success: boolean;
  error?: string;
}

const PAGE_PATHS: Record<string, string> = {
  pricing: '/pricing',
  features: '/features',
  homepage: '',
  blog: '/blog',
  careers: '/careers',
};

/**
 * Step Function Lambda: Scrape all tracked pages for a single competitor.
 */
export const handler = async (event: Event): Promise<{ compId: string; userId: string; name: string; pages: PageResult[] }> => {
  logger.info('ScrapePages started', { compId: event.compId, url: event.url, pageCount: event.pagesToTrack.length });

  const baseUrl = event.url.replace(/\/+$/, '');
  const pages: PageResult[] = [];

  for (const pageType of event.pagesToTrack) {
    const pageUrl = `${baseUrl}${PAGE_PATHS[pageType] ?? `/${pageType}`}`;

    try {
      const result = await scrapeUrl(pageUrl);
      pages.push({
        pageUrl,
        markdown: result.markdown,
        success: true,
      });
    } catch (err) {
      logger.warn('Page scrape failed', { compId: event.compId, pageUrl, error: String(err) });
      pages.push({
        pageUrl,
        markdown: '',
        success: false,
        error: String(err),
      });
    }
  }

  const successCount = pages.filter((p) => p.success).length;
  logger.info('ScrapePages completed', { compId: event.compId, successCount, totalPages: pages.length });

  return {
    compId: event.compId,
    userId: event.userId,
    name: event.name,
    pages,
  };
};
