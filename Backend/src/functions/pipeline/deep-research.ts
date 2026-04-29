import {
  deepResearch,
  detectResearchDeltas,
  scoreCompetitorThreat,
  predictNextMoves,
  evaluatePriorPredictions,
} from '../../shared/services/anthropic';
import { putItem, queryByPK, updateItem, getItem } from '../../shared/db/queries';
import {
  researchPK,
  researchSK,
  changePK,
  changeSK,
  competitorPK,
  competitorSK,
  userPK,
  userSK,
  gsi1ResearchKeys,
  gsi1ChangeKeys,
} from '../../shared/db/keys';
import { generateId } from '../../shared/utils/id';
import { logger } from '../../shared/utils/logger';
import {
  buildChangesByDay,
  computeMomentum,
  deriveTagsFromState,
} from '../../shared/utils/competitor-metrics';
import type {
  ResearchFinding,
  PredictedMove,
  EvaluatedPrediction,
} from '../../shared/types';

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
    // 1. Load up to 3 prior research findings (newest first via descending SK scan).
    //    Index 0 is used for delta detection; the full list (up to 3) feeds
    //    predictNextMoves with richer historical context.
    const { items: priorItems } = await queryByPK(
      `COMP#${event.competitorId}`,
      'RESEARCH#',
      { limit: 3 }
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

    const findingsCount =
      current.categories.news.length +
      current.categories.product.length +
      current.categories.funding.length +
      current.categories.hiring.length +
      current.categories.social.length;

    // 3. Detect deltas against prior finding BEFORE storing the new one.
    //    If this fails, we leave the prior finding in place for a clean retry.
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

    // 4. Persist the new ResearchFinding (only after delta detection succeeded)
    const researchId = generateId();
    const generatedAt = new Date().toISOString();

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

    // 6. Post-research enrichment: momentum (rules) + threat (Haiku) + tags (rules)
    //    + predictions (Sonnet) + prediction evaluation (Sonnet).
    //    Persisted on the Competitor record in a single atomic update so list
    //    views render without recomputing. Failures here are logged but do not
    //    fail the run — the user still gets the finding and any deltas.
    try {
      const enrichmentNow = new Date();

      // Query last 30 days of changes + the existing competitor record. The
      // changes feed momentum/threat/tags/predictions; the competitor record
      // gives us the prior predictedMoves to evaluate against fresh evidence.
      const [changesResult, competitorRecord] = await Promise.all([
        queryByPK(`COMP#${event.competitorId}`, 'CHANGE#', { limit: 100 }),
        getItem<Record<string, unknown>>(
          competitorPK(event.userId),
          competitorSK(event.competitorId)
        ),
      ]);
      const { items: recentChangeItems } = changesResult;

      // Momentum (rule-based, no AI cost)
      const timestamps = recentChangeItems
        .map((c) => c.detectedAt as string | undefined)
        .filter((ts): ts is string => typeof ts === 'string');
      const changesByDay = buildChangesByDay(timestamps, enrichmentNow);
      const { momentum, momentumChangePercent } = computeMomentum({ changesByDay });

      // Threat level (Haiku call). Best-effort — wrapped so failures don't break momentum write.
      let threatLevel: string | undefined;
      let threatReasoning: string | undefined;
      try {
        const user = await getItem<Record<string, unknown>>(
          userPK(event.userId),
          userSK()
        );
        const userCompanyName = (user?.companyName as string | undefined) ?? undefined;
        const userIndustry = (user?.industry as string | undefined) ?? undefined;

        const recentChangeSummaries = recentChangeItems
          .map((c) => ({
            summary: ((c.aiAnalysis as { summary?: string } | undefined)?.summary ?? '') as string,
            significance: (c.significance as number) ?? 0,
            detectedAt: (c.detectedAt as string) ?? '',
          }))
          .filter((c) => c.summary && c.detectedAt);

        const threat = await scoreCompetitorThreat({
          competitorName: event.name,
          userCompanyName,
          userIndustry,
          latestFinding: {
            summary: current.summary,
            categories: current.categories,
            derivedState: current.derivedState,
          },
          recentChanges: recentChangeSummaries,
          momentum,
        });
        threatLevel = threat.threatLevel;
        threatReasoning = threat.reasoning;
      } catch (err) {
        logger.warn('Threat scoring failed — continuing without threat update', {
          competitorId: event.competitorId,
          error: String(err),
        });
      }

      // Derive tag chips from structured state + recent changes + momentum/threat.
      // Pure rules — runs synchronously over data already in memory.
      const recentChangesForTags = recentChangeItems.map((c) => ({
        sourceCategory: c.sourceCategory as string | undefined,
        detectedAt: (c.detectedAt as string) ?? '',
      }));
      const derivedTags = deriveTagsFromState({
        derivedState: current.derivedState,
        recentChanges: recentChangesForTags,
        momentum,
        threatLevel: threatLevel as
          | 'critical'
          | 'high'
          | 'medium'
          | 'low'
          | 'monitor'
          | undefined,
      });

      // Reusable shape used by both the evaluator and the predictor.
      const recentChangesForAi = recentChangeItems
        .slice(0, 8)
        .map((c) => ({
          summary:
            ((c.aiAnalysis as { summary?: string } | undefined)?.summary ?? '') as string,
          sourceCategory: c.sourceCategory as string | undefined,
          detectedAt: (c.detectedAt as string) ?? '',
        }))
        .filter((c) => c.summary && c.detectedAt);

      // Evaluate prior predictions against fresh evidence BEFORE generating new
      // ones. The current predictedMoves on the competitor record (if any)
      // become candidates for status assignment — realized / partially-realized
      // / expired / pending — and are then appended to predictionHistory.
      const newHistoryEntries: EvaluatedPrediction[] = [];
      const priorPredictedMoves =
        (competitorRecord?.predictedMoves as PredictedMove[] | undefined) ?? [];
      const priorPredictedAt =
        (competitorRecord?.predictedMovesAsOf as string | undefined) ?? undefined;
      if (priorPredictedMoves.length > 0 && priorPredictedAt) {
        try {
          const evalInput = priorPredictedMoves.map((p) => ({
            move: p.move,
            reasoning: p.reasoning,
            timeHorizon: p.timeHorizon,
            category: p.category,
            predictedAt: priorPredictedAt,
          }));
          const evaluations = await evaluatePriorPredictions({
            competitorName: event.name,
            priorPredictions: evalInput,
            latestFinding: {
              summary: current.summary,
              categories: current.categories,
              derivedState: current.derivedState,
            },
            recentChanges: recentChangesForAi,
            now: enrichmentNow,
          });

          for (let i = 0; i < priorPredictedMoves.length; i++) {
            const p = priorPredictedMoves[i];
            const ev = evaluations[i] ?? { status: 'pending' as const };
            newHistoryEntries.push({
              move: p.move,
              reasoning: p.reasoning,
              probability: p.probability,
              timeHorizon: p.timeHorizon,
              category: p.category,
              predictedAt: priorPredictedAt,
              evaluatedAt: enrichmentNow.toISOString(),
              status: ev.status,
              ...(ev.evidence ? { evidence: ev.evidence } : {}),
              ...(ev.evidenceUrl ? { evidenceUrl: ev.evidenceUrl } : {}),
            });
          }
        } catch (err) {
          logger.warn('Prediction evaluation failed — skipping history append', {
            competitorId: event.competitorId,
            error: String(err),
          });
        }
      }

      // Predicted next moves — Sonnet call, only when ≥ 1 prior finding exists.
      // Best-effort: a failure here should not block momentum/threat/tags writes.
      let predictedMoves: PredictedMove[] = [];
      if (priorItems.length >= 1) {
        try {
          const priorsCompact = priorItems
            .slice(0, 3)
            .map((p) => p as unknown as ResearchFinding)
            .map((p) => ({
              summary: p.summary,
              categories: p.categories,
              derivedState: p.derivedState,
              generatedAt: p.generatedAt,
            }));

          predictedMoves = await predictNextMoves({
            competitorName: event.name,
            latestFinding: {
              summary: current.summary,
              categories: current.categories,
              derivedState: current.derivedState,
              generatedAt,
            },
            priorFindings: priorsCompact,
            recentChanges: recentChangesForAi,
          });
        } catch (err) {
          logger.warn('Prediction failed — continuing without prediction update', {
            competitorId: event.competitorId,
            error: String(err),
          });
        }
      }

      // Single update with all enrichment fields set atomically
      const updates: Record<string, unknown> = {
        momentum,
        momentumChangePercent,
        momentumAsOf: enrichmentNow.toISOString(),
        derivedTags,
        derivedTagsAsOf: enrichmentNow.toISOString(),
        updatedAt: enrichmentNow.toISOString(),
      };
      if (threatLevel) {
        updates.threatLevel = threatLevel;
        updates.threatReasoning = threatReasoning ?? '';
        updates.threatAsOf = enrichmentNow.toISOString();
      }
      if (predictedMoves.length > 0) {
        updates.predictedMoves = predictedMoves;
        updates.predictedMovesAsOf = enrichmentNow.toISOString();
      }
      // Append newly evaluated predictions to predictionHistory (cap at 50 to
      // bound DynamoDB item size). Newest entries kept; oldest dropped.
      if (newHistoryEntries.length > 0) {
        const existingHistory =
          (competitorRecord?.predictionHistory as EvaluatedPrediction[] | undefined) ?? [];
        const merged = [...newHistoryEntries, ...existingHistory].slice(0, 50);
        updates.predictionHistory = merged;
        updates.predictionHistoryAsOf = enrichmentNow.toISOString();
      }

      await updateItem(
        competitorPK(event.userId),
        competitorSK(event.competitorId),
        updates
      );
      logger.info('Enrichment persisted', {
        competitorId: event.competitorId,
        momentum,
        momentumChangePercent,
        threatLevel,
        derivedTagsCount: derivedTags.length,
        derivedTags,
        predictionsCount: predictedMoves.length,
        evaluatedCount: newHistoryEntries.length,
        evaluatedStatuses: newHistoryEntries.map((e) => e.status),
      });
    } catch (err) {
      logger.warn('Post-research enrichment failed — continuing', {
        competitorId: event.competitorId,
        error: String(err),
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
