import {
  deepResearch,
  detectResearchDeltas,
  scoreCompetitorThreat,
  predictNextMoves,
  evaluatePriorPredictions,
} from '../../shared/services/anthropic';
import {
  dispatchCriticalAlert,
  dispatchViewMatch,
} from '../../shared/services/notifier';
import type { SavedView, User } from '../../shared/types';
import { putItem, queryByPK, updateItem, getItem } from '../../shared/db/queries';
import {
  researchPK,
  researchSK,
  changePK,
  changeSK,
  competitorPK,
  competitorSK,
  savedViewPK,
  savedViewSKPrefix,
  userPK,
  userSK,
  gsi1ResearchKeys,
  gsi1ChangeKeys,
} from '../../shared/db/keys';
import { matchesViewFilters } from '../../shared/utils/view-filters';
import { generateId } from '../../shared/utils/id';
import { logger } from '../../shared/utils/logger';
import {
  buildChangesByDay,
  computeMomentum,
  deriveTagsFromState,
} from '../../shared/utils/competitor-metrics';
import type {
  ApplicationEvent,
  ResearchFinding,
  PredictedMove,
  EvaluatedPrediction,
} from '../../shared/types';
import {
  flushEventsToRun,
  makeRunEvent,
  markRunFinished,
} from '../../shared/services/research-run';

interface Event {
  competitorId: string;
  userId: string;
  name: string;
  url: string;
  industry?: string;
  // Phase 22 — observability handle. Optional for backwards-compat with
  // legacy executions that started before the field was introduced.
  runId?: string;
  runStartedAt?: string;
  tenantUserId?: string;
  // Phase 23 — Brand Pulse. `'self'` switches the deepResearch prompt
  // framing, skips threat scoring + predictions, and routes tag derivation
  // to the self-brand rule set. Absent / `'competitor'` preserves prior
  // behaviour for back-compat with in-flight executions.
  targetKind?: 'competitor' | 'self';
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
    runId: event.runId,
  });

  // Phase 22 — accumulate progress events in memory and flush to the
  // ResearchRun row at end-of-run. The trigger handler already wrote a
  // `run_queued` event; we add `research_started` first to surface
  // immediately when the row is next read.
  const runEvents: ApplicationEvent[] = [];
  const tenantUserId = event.tenantUserId ?? event.userId;
  const haveRunRow = !!event.runId && !!event.runStartedAt;
  runEvents.push(makeRunEvent('research_started', { competitorId: event.competitorId }));

  if (haveRunRow) {
    // Early flush so the dashboard reflects "research started" within ~2s
    // even if the deep-research call takes 60s. Best-effort.
    await flushEventsToRun(tenantUserId, event.runStartedAt!, event.runId!, runEvents);
  }

  try {
    // 1. Load up to 3 prior research findings + the user record in parallel.
    //    Index 0 of priorItems is used for delta detection; the full list
    //    feeds predictNextMoves with richer historical context. The user
    //    record gives us companyName + industry that's threaded into every
    //    AI call for user-relevant framing.
    const [priorResult, userRecord] = await Promise.all([
      queryByPK(`COMP#${event.competitorId}`, 'RESEARCH#', { limit: 3 }),
      getItem<Record<string, unknown>>(userPK(event.userId), userSK()),
    ]);
    const priorItems = priorResult.items;
    const previous = (priorItems[0] as unknown as ResearchFinding | undefined) ?? null;
    const isFirstRun = priorItems.length === 0;
    const userCompanyName = (userRecord?.companyName as string | undefined) ?? undefined;
    const userIndustry = (userRecord?.industry as string | undefined) ?? undefined;

    // 2. Run web_search-backed research. Pass the most recent prior snapshot
    //    (if any) so Claude can bias its 8 web searches toward what's new
    //    since then — without dropping known facts from the output.
    const isSelf = event.targetKind === 'self';
    const current = await deepResearch({
      competitorId: event.competitorId,
      userId: event.userId,
      name: event.name,
      url: event.url,
      industry: event.industry,
      userCompanyName,
      userIndustry,
      targetKind: event.targetKind,
      priorContext: previous
        ? {
            summary: previous.summary,
            derivedState: previous.derivedState,
            generatedAt: previous.generatedAt,
          }
        : undefined,
    });

    const findingsCount =
      current.categories.news.length +
      current.categories.product.length +
      current.categories.funding.length +
      current.categories.hiring.length +
      current.categories.social.length;
    runEvents.push(
      makeRunEvent('deep_research_completed', {
        findings: findingsCount,
        citations: current.citations.length,
        tokensUsed: current.tokensUsed,
      })
    );

    // 3. Detect deltas against prior finding BEFORE storing the new one.
    //    If this fails, we leave the prior finding in place for a clean retry.
    let deltas: Awaited<ReturnType<typeof detectResearchDeltas>> = [];
    if (previous) {
      deltas = await detectResearchDeltas({
        competitorName: event.name,
        userId: event.userId,
        previous: {
          summary: previous.summary,
          categories: previous.categories,
          generatedAt: previous.generatedAt,
          derivedState: previous.derivedState,
        },
        current: {
          summary: current.summary,
          categories: current.categories,
          derivedState: current.derivedState,
        },
      });
      runEvents.push(makeRunEvent('deltas_detected', { count: deltas.length }));
    } else {
      runEvents.push(makeRunEvent('first_run_no_prior_finding'));
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

    // Phase 5 funnel event — emit on the first successful research per competitor.
    // The whole-user-first-research event is harder to dedupe cheaply (would
    // need a separate per-user marker); per-competitor is the metric we
    // actually care about for funnel measurement.
    if (isFirstRun) {
      logger.info('first_research_completed', {
        userId: event.userId,
        competitorId: event.competitorId,
        researchId,
        findingsCount:
          current.categories.news.length +
          current.categories.product.length +
          current.categories.funding.length +
          current.categories.hiring.length +
          current.categories.social.length,
      });
    }

    // 5. Persist each delta as a Change record + fire real-time critical
    //    alerts for significance >= 8 (the Phase 3 "Slack-pings-now" bar).
    //    The chained send-alert.ts task handles the lower 7-bucket via the
    //    same notifier facade — these two thresholds give us interrupt vs
    //    follow-up framing without double-notifying on the same delta.
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

      // Real-time critical alert (sig >= 8). Best-effort — failure logs
      // but doesn't break the research run.
      if (delta.significanceScore >= 8 && userRecord?.email) {
        try {
          await dispatchCriticalAlert({
            user: {
              userId: event.userId,
              email: userRecord.email as string,
              name: (userRecord.name as string) ?? '',
              notificationPreferences: (userRecord as unknown as User).notificationPreferences,
            },
            competitorName: event.name,
            changeId,
            changeTitle: delta.title,
            changeDetail: delta.detail,
            significance: delta.significanceScore,
            category: delta.category,
            citationUrl: delta.sourceUrl,
          });
        } catch (err) {
          logger.warn('deep-research: critical-alert dispatch failed — continuing', {
            competitorId: event.competitorId,
            changeId,
            error: String(err),
          });
        }
      }
    }

    // Phase 17 — fan-out matching saved views to the workspace's webhook
    // integration. Walks the workspace's saved views, filters to those with
    // webhookOnMatch=true, dispatches one HMAC-signed POST per (change,view)
    // pair. Best-effort + parallel via Promise.allSettled — one failed
    // webhook never blocks others or breaks the pipeline run. No-op for
    // workspaces without a webhook integration.
    if (storedChanges.length > 0 && userRecord?.email) {
      try {
        const { items: viewItems } = await queryByPK(
          savedViewPK(event.userId),
          savedViewSKPrefix()
        );
        const webhookViews = (viewItems as unknown as SavedView[]).filter(
          (v) => v.webhookOnMatch === true
        );
        if (webhookViews.length > 0) {
          const ownerEmail = userRecord.email as string;
          const ownerName = (userRecord.name as string) ?? '';
          const ownerPrefs = (userRecord as unknown as User).notificationPreferences;
          const dispatches: Promise<unknown>[] = [];

          for (let i = 0; i < deltas.length; i++) {
            const delta = deltas[i];
            const stored = storedChanges[i];
            if (!stored) continue;
            // Build the FilterableChange shape from delta + stored fields.
            const filterable = {
              significance: delta.significanceScore,
              competitorId: event.competitorId,
              detectedAt: new Date().toISOString(),
              changeType: delta.changeType,
            };
            for (const view of webhookViews) {
              if (!matchesViewFilters(filterable, view.filters)) continue;
              dispatches.push(
                dispatchViewMatch({
                  user: {
                    userId: event.userId,
                    email: ownerEmail,
                    name: ownerName,
                    notificationPreferences: ownerPrefs,
                  },
                  workspaceId: '(pipeline)',
                  view: { id: view.id, name: view.name },
                  change: {
                    id: stored.changeId,
                    competitorId: event.competitorId,
                    competitorName: event.name,
                    pageUrl: stored.pageUrl,
                    significance: stored.significance,
                    detectedAt: filterable.detectedAt,
                    summary: delta.title,
                    changeType: delta.changeType,
                  },
                }).catch((err) => {
                  logger.warn('deep-research: view-match webhook failed', {
                    competitorId: event.competitorId,
                    viewId: view.id,
                    changeId: stored.changeId,
                    error: String(err),
                  });
                })
              );
              logger.info('saved_view_webhook_matched', {
                tenantUserId: event.userId,
                competitorId: event.competitorId,
                viewId: view.id,
                viewName: view.name,
                changeId: stored.changeId,
              });
            }
          }

          if (dispatches.length > 0) {
            await Promise.allSettled(dispatches);
          }
        }
      } catch (err) {
        logger.warn('deep-research: saved-view webhook fan-out failed — continuing', {
          competitorId: event.competitorId,
          error: String(err),
        });
      }
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
      // userCompanyName + userIndustry come from the top-of-handler user load.
      // Phase 23 — skip for self-brand targets: "how threatening is our own
      // brand to us" is nonsensical and the field stays undefined on the row.
      let threatLevel: string | undefined;
      let threatReasoning: string | undefined;
      if (!isSelf) {
        try {
          const recentChangeSummaries = recentChangeItems
            .map((c) => ({
              summary: ((c.aiAnalysis as { summary?: string } | undefined)?.summary ?? '') as string,
              significance: (c.significance as number) ?? 0,
              detectedAt: (c.detectedAt as string) ?? '',
            }))
            .filter((c) => c.summary && c.detectedAt);

          const threat = await scoreCompetitorThreat({
            competitorName: event.name,
            userId: event.userId,
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
        targetKind: event.targetKind,
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
      // Phase 23 — skipped for self-brand: predicting our own moves is circular.
      const newHistoryEntries: EvaluatedPrediction[] = [];
      const priorPredictedMoves =
        (competitorRecord?.predictedMoves as PredictedMove[] | undefined) ?? [];
      const priorPredictedAt =
        (competitorRecord?.predictedMovesAsOf as string | undefined) ?? undefined;
      if (!isSelf && priorPredictedMoves.length > 0 && priorPredictedAt) {
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
            userId: event.userId,
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
      // Phase 23 — skipped for self-brand: same reason as evaluatePriorPredictions.
      let predictedMoves: PredictedMove[] = [];
      if (!isSelf && priorItems.length >= 1) {
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
            userId: event.userId,
            latestFinding: {
              summary: current.summary,
              categories: current.categories,
              derivedState: current.derivedState,
              generatedAt,
            },
            priorFindings: priorsCompact,
            recentChanges: recentChangesForAi,
            userCompanyName,
            userIndustry,
            momentum,
            momentumChangePercent,
            threatLevel: threatLevel as
              | 'critical'
              | 'high'
              | 'medium'
              | 'low'
              | 'monitor'
              | undefined,
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
      runEvents.push(
        makeRunEvent('enrichment_completed', {
          momentum: momentum ?? 'unknown',
          threatLevel: threatLevel ?? 'unscored',
          tags: derivedTags.length,
          predictions: predictedMoves.length,
        })
      );
    } catch (err) {
      logger.warn('Post-research enrichment failed — continuing', {
        competitorId: event.competitorId,
        error: String(err),
      });
      runEvents.push(
        makeRunEvent('enrichment_failed', { error: String(err).slice(0, 200) }, 'warn')
      );
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

    runEvents.push(
      makeRunEvent('research_succeeded', {
        deltas: storedChanges.length,
        findings: findingsCount,
        tokensUsed: current.tokensUsed,
      })
    );
    if (haveRunRow) {
      await markRunFinished(tenantUserId, event.runStartedAt!, event.runId!, {
        status: 'succeeded',
        deltaCount: storedChanges.length,
        citationCount: current.citations.length,
        events: runEvents,
      });
    }

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
    runEvents.push(
      makeRunEvent('research_failed', { error: String(err).slice(0, 200) }, 'error')
    );
    if (haveRunRow) {
      await markRunFinished(tenantUserId, event.runStartedAt!, event.runId!, {
        status: 'failed',
        errorMessage: String(err),
        events: runEvents,
      });
    }
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
