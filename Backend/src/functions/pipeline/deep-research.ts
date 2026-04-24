import { deepResearch, detectResearchDeltas } from '../../shared/services/anthropic';
import { putItem, queryByPK } from '../../shared/db/queries';
import {
  researchPK,
  researchSK,
  changePK,
  changeSK,
  gsi1ResearchKeys,
  gsi1ChangeKeys,
} from '../../shared/db/keys';
import { generateId } from '../../shared/utils/id';
import { logger } from '../../shared/utils/logger';
import type { ResearchFinding } from '../../shared/types';

interface Event {
  competitorId: string;
  userId: string;
  name: string;
  url: string;
  industry?: string;
}

interface StoredChange {
  changeId: string;
  significance: number;
  pageUrl: string;
  summary: string;
}

interface Output {
  compId: string;
  userId: string;
  name: string;
  researchId: string;
  findingsCount: number;
  deltasFound: number;
  storedChanges: StoredChange[];
  success: boolean;
  error?: string;
}

/**
 * Step Function Lambda: Full intelligence pass for a single competitor.
 *   1. Load the most recent prior ResearchFinding (may be null on first run).
 *   2. Run web_search-backed deepResearch() → current findings.
 *   3. Persist current findings as a new ResearchFinding.
 *   4. If prior exists, call detectResearchDeltas() → list of new items with impact analysis.
 *   5. For each delta, persist a Change record (with researchId + citations + sourceCategory).
 *   6. Return storedChanges[] for the chained SendAlertTask.
 */
export const handler = async (event: Event): Promise<Output> => {
  logger.info('DeepResearch started', {
    competitorId: event.competitorId,
    name: event.name,
    url: event.url,
  });

  try {
    // 1. Load previous research finding (newest first via descending SK scan)
    const { items: priorItems } = await queryByPK(
      `COMP#${event.competitorId}`,
      'RESEARCH#',
      { limit: 1 }
    );
    const previous = (priorItems[0] as unknown as ResearchFinding | undefined) ?? null;

    // 2. Run web_search-backed research
    const current = await deepResearch({
      competitorId: event.competitorId,
      userId: event.userId,
      name: event.name,
      url: event.url,
      industry: event.industry,
    });

    // 3. Persist the new ResearchFinding
    const researchId = generateId();
    const generatedAt = new Date().toISOString();

    const findingsCount =
      current.categories.news.length +
      current.categories.product.length +
      current.categories.funding.length +
      current.categories.hiring.length +
      current.categories.social.length;

    await putItem({
      PK: researchPK(event.competitorId),
      SK: researchSK(generatedAt),
      id: researchId,
      competitorId: event.competitorId,
      userId: event.userId,
      generatedAt,
      summary: current.summary,
      categories: current.categories,
      citations: current.citations,
      searchQueries: current.searchQueries,
      tokensUsed: current.tokensUsed,
      ...gsi1ResearchKeys(event.userId, generatedAt),
    });

    // 4. Detect deltas against prior finding, if any
    let deltas: Awaited<ReturnType<typeof detectResearchDeltas>> = [];
    if (previous) {
      deltas = await detectResearchDeltas({
        competitorName: event.name,
        previous: {
          summary: previous.summary,
          categories: previous.categories,
          generatedAt: previous.generatedAt,
        },
        current: {
          summary: current.summary,
          categories: current.categories,
        },
      });
    }

    // 5. Persist each delta as a Change record
    const storedChanges: StoredChange[] = [];
    for (const delta of deltas) {
      const changeId = generateId();
      const detectedAt = new Date().toISOString();

      await putItem({
        PK: changePK(event.competitorId),
        SK: changeSK(detectedAt),
        id: changeId,
        competitorId: event.competitorId,
        competitorName: event.name,
        userId: event.userId,
        pageUrl: delta.sourceUrl,
        diffSummary: delta.detail,
        significance: delta.significanceScore,
        aiAnalysis: {
          changeType: delta.changeType,
          summary: delta.title,
          significanceScore: delta.significanceScore,
          strategicImplication: delta.strategicImplication,
          recommendedAction: delta.recommendedAction,
        },
        detectedAt,
        researchId,
        citations: current.citations,
        sourceCategory: delta.category,
        ...gsi1ChangeKeys(event.userId, detectedAt),
      });

      storedChanges.push({
        changeId,
        significance: delta.significanceScore,
        pageUrl: delta.sourceUrl,
        summary: delta.title,
      });
    }

    logger.info('DeepResearch completed', {
      competitorId: event.competitorId,
      researchId,
      findingsCount,
      citationsCount: current.citations.length,
      searchQueriesCount: current.searchQueries.length,
      tokensUsed: current.tokensUsed,
      deltasFound: deltas.length,
      storedChanges: storedChanges.length,
      firstRun: !previous,
    });

    return {
      compId: event.competitorId,
      userId: event.userId,
      name: event.name,
      researchId,
      findingsCount,
      deltasFound: deltas.length,
      storedChanges,
      success: true,
    };
  } catch (err) {
    logger.error('DeepResearch failed', {
      competitorId: event.competitorId,
      error: String(err),
    });
    return {
      compId: event.competitorId,
      userId: event.userId,
      name: event.name,
      researchId: '',
      findingsCount: 0,
      deltasFound: 0,
      storedChanges: [],
      success: false,
      error: String(err),
    };
  }
};
