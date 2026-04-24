import { deepResearch } from '../../shared/services/anthropic';
import { putItem } from '../../shared/db/queries';
import { researchPK, researchSK, gsi1ResearchKeys } from '../../shared/db/keys';
import { generateId } from '../../shared/utils/id';
import { logger } from '../../shared/utils/logger';

interface Event {
  competitorId: string;
  userId: string;
  name: string;
  url: string;
  industry?: string;
}

interface Output {
  competitorId: string;
  researchId: string;
  findingsCount: number;
  tokensUsed: number;
  success: boolean;
  error?: string;
}

/**
 * Step Function Lambda: Run Claude deep research on one competitor.
 * Uses Claude Sonnet + web_search tool, writes a ResearchFinding to DynamoDB.
 */
export const handler = async (event: Event): Promise<Output> => {
  logger.info('DeepResearch started', {
    competitorId: event.competitorId,
    name: event.name,
    url: event.url,
  });

  try {
    const result = await deepResearch({
      competitorId: event.competitorId,
      userId: event.userId,
      name: event.name,
      url: event.url,
      industry: event.industry,
    });

    const researchId = generateId();
    const generatedAt = new Date().toISOString();

    const findingsCount =
      result.categories.news.length +
      result.categories.product.length +
      result.categories.funding.length +
      result.categories.hiring.length +
      result.categories.social.length;

    await putItem({
      PK: researchPK(event.competitorId),
      SK: researchSK(generatedAt),
      id: researchId,
      competitorId: event.competitorId,
      userId: event.userId,
      generatedAt,
      summary: result.summary,
      categories: result.categories,
      citations: result.citations,
      searchQueries: result.searchQueries,
      tokensUsed: result.tokensUsed,
      ...gsi1ResearchKeys(event.userId, generatedAt),
    });

    logger.info('DeepResearch completed', {
      competitorId: event.competitorId,
      researchId,
      findingsCount,
      citationsCount: result.citations.length,
      searchQueriesCount: result.searchQueries.length,
      tokensUsed: result.tokensUsed,
    });

    return {
      competitorId: event.competitorId,
      researchId,
      findingsCount,
      tokensUsed: result.tokensUsed,
      success: true,
    };
  } catch (err) {
    logger.error('DeepResearch failed', {
      competitorId: event.competitorId,
      error: String(err),
    });
    return {
      competitorId: event.competitorId,
      researchId: '',
      findingsCount: 0,
      tokensUsed: 0,
      success: false,
      error: String(err),
    };
  }
};
