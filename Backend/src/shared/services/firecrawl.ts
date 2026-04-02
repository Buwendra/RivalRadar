import { getSecret } from './secrets';
import { logger } from '../utils/logger';

interface ScrapeResult {
  url: string;
  markdown: string;
  metadata?: {
    title?: string;
    description?: string;
  };
}

/**
 * Scrape a URL via the Firecrawl API and return clean markdown content.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const secrets = await getSecret('rivalscan/api-keys');
  const apiKey = secrets.FIRECRAWL_API_KEY;

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      waitFor: 5000,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('Firecrawl scrape failed', { url, status: response.status, error: errorBody });
    throw new Error(`Firecrawl scrape failed for ${url}: ${response.status}`);
  }

  const data = (await response.json()) as {
    success: boolean;
    data: { markdown: string; metadata?: { title?: string; description?: string } };
  };

  if (!data.success) {
    throw new Error(`Firecrawl returned unsuccessful for ${url}`);
  }

  return {
    url,
    markdown: data.data.markdown,
    metadata: data.data.metadata,
  };
}
