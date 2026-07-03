/**
 * Step Function Lambda — Phase 2 of the weekly digest pipeline.
 *
 * Runs after `generate-summary` (so the strategic summary can inform the
 * recommendations) and before `render-send-email` (so the email can embed
 * the top 3). Single Sonnet call (~$0.05) per user per week.
 *
 * Sequence:
 *   1. Load the user record (companyName + industry for prompt framing).
 *   2. Load the user's competitors with current `predictedMoves` so the rec
 *      prompt knows what the LLM already thinks each competitor will do.
 *   3. Call `generateRecommendations` with the rich context.
 *   4. Persist each rec as a Recommendation row (PK=USER#<id>, SK=REC#<ts>),
 *      indexed on GSI1 for the combined-feed query.
 *   5. Return the top 3 (sorted by confidence × significance heuristic) so
 *      `render-send-email` can embed them in the digest.
 *
 * Best-effort: any failure here logs and returns an empty `topRecommendations`
 * array — the digest email still goes out without the rec section.
 */

import { generateRecommendations } from '../../shared/services/anthropic';
import { putItem, queryByPK, getItem } from '../../shared/db/queries';
import {
  recommendationPK,
  recommendationSK,
  competitorPK,
  userPK,
  userSK,
  gsi1RecommendationKeys,
} from '../../shared/db/keys';
import { generateId } from '../../shared/utils/id';
import { logger } from '../../shared/utils/logger';
import { hasCapability } from '../../shared/utils/capability';
import type { Recommendation, PredictedMove, User } from '../../shared/types';

interface AggregatedChange {
  competitorName: string;
  pageUrl: string;
  summary: string;
  significanceScore: number;
  changeType: string;
  detectedAt: string;
  changeId?: string;
}

interface CompetitorSnapshot {
  name: string;
  momentum?: string;
  threatLevel?: string;
  topTags?: string[];
  stage?: string;
}

interface Event {
  userId: string;
  email: string;
  name: string;
  topChanges: AggregatedChange[];
  competitorSnapshots: CompetitorSnapshot[];
  strategicSummary: string;
  /** Set upstream by aggregate-changes when the user has no competitors. */
  skip?: boolean;
}

type Output = Event & { topRecommendations: Recommendation[] };

export const handler = async (event: Event): Promise<Output> => {
  // Upstream said this user gets no digest at all (no competitors).
  if (event.skip) {
    return { ...event, topRecommendations: [] };
  }

  // Empty digest → skip generation cleanly. Don't emit a "nothing to do"
  // recommendation — the email already says no significant changes detected.
  if (event.topChanges.length === 0 && event.competitorSnapshots.length === 0) {
    return { ...event, topRecommendations: [] };
  }

  let userCompanyName: string | undefined;
  let userIndustry: string | undefined;
  let customCategories: string[] | undefined;
  let competitorsForPrompt: Array<{
    name: string;
    momentum?: string;
    threatLevel?: string;
    topTags?: string[];
    stage?: string;
    predictedMoves?: Array<{ move: string; timeHorizon: string; category: string }>;
  }> = event.competitorSnapshots;

  try {
    const [userRecord, competitorsResult] = await Promise.all([
      getItem<User & Record<string, unknown>>(userPK(event.userId), userSK()),
      queryByPK(competitorPK(event.userId), 'COMP#', { scanForward: true }),
    ]);
    // Phase 23 — recommendations are about competitive moves; exclude self-brand.
    const competitorItems = competitorsResult.items.filter((c) => c.targetKind !== 'self');
    userCompanyName = userRecord?.companyName as string | undefined;
    userIndustry = userRecord?.industry as string | undefined;
    // Custom recommendation focus areas (Command-tier only). The capability
    // gate prevents lower tiers from getting custom categories applied even
    // if a stale field somehow survives a downgrade.
    if (
      userRecord &&
      hasCapability(userRecord, 'customRecommendationCategories') &&
      Array.isArray(userRecord.customRecommendationCategories) &&
      userRecord.customRecommendationCategories.length > 0
    ) {
      customCategories = userRecord.customRecommendationCategories.slice(0, 3);
    }

    // Enrich each snapshot with predictedMoves from the live Competitor record.
    // Snapshots from aggregate-changes don't include predictedMoves to keep the
    // SFN payload trim, but the recommendations prompt benefits from knowing
    // what the LLM already predicted each competitor will do.
    const movesByName = new Map<string, PredictedMove[]>();
    for (const c of competitorItems) {
      const name = c.name as string | undefined;
      const moves = c.predictedMoves as PredictedMove[] | undefined;
      if (name && moves && moves.length > 0) movesByName.set(name, moves);
    }
    competitorsForPrompt = event.competitorSnapshots.map((s) => {
      const moves = movesByName.get(s.name);
      return moves
        ? {
            ...s,
            predictedMoves: moves.slice(0, 2).map((m) => ({
              move: m.move,
              timeHorizon: m.timeHorizon,
              category: m.category,
            })),
          }
        : s;
    });
  } catch (err) {
    logger.warn('GenerateRecommendations: pre-flight context load failed — proceeding with stub', {
      userId: event.userId,
      error: String(err),
    });
  }

  // Build the prompt input. `changeId` is optional on AggregatedChange today
  // (aggregate-changes doesn't surface it) but we plumb it through for future
  // wiring without breaking the generator now.
  //
  // Best-effort for real: an AI failure here degrades to a recommendations-
  // free digest instead of throwing and killing this subscriber's iteration
  // (the file header always promised this; the call used to sit outside the
  // guard).
  let recs: Awaited<ReturnType<typeof generateRecommendations>>;
  try {
    recs = await generateRecommendations({
      userId: event.userId,
      userCompanyName,
      userIndustry,
      ...(customCategories ? { customCategories } : {}),
      weeklyChanges: event.topChanges.map((c) => ({
        competitorName: c.competitorName,
        summary: c.summary,
        significanceScore: c.significanceScore,
        changeType: c.changeType,
        changeId: c.changeId,
      })),
      competitorSnapshots: competitorsForPrompt,
      strategicSummary: event.strategicSummary,
    });
  } catch (err) {
    logger.warn('GenerateRecommendations: AI call failed — sending digest without recommendations', {
      userId: event.userId,
      error: String(err),
    });
    return { ...event, topRecommendations: [] };
  }

  if (recs.length === 0) {
    logger.info('GenerateRecommendations: no recommendations produced for user', {
      userId: event.userId,
    });
    return { ...event, topRecommendations: [] };
  }

  const now = new Date();
  const persisted: Recommendation[] = [];

  for (const rec of recs) {
    const id = generateId();
    // Use ISO with millisecond resolution so multiple recs from the same run
    // sort deterministically by their array order via the SK suffix.
    const createdAt = new Date(now.getTime() + persisted.length).toISOString();
    const stored: Recommendation = {
      id,
      userId: event.userId,
      ...(rec.competitorName ? { competitorName: rec.competitorName } : {}),
      triggeringChangeIds: rec.triggeringChangeIds,
      category: rec.category,
      title: rec.title,
      body: rec.body,
      effortLevel: rec.effortLevel,
      timeHorizon: rec.timeHorizon,
      confidence: rec.confidence,
      status: 'open',
      createdAt,
    };

    try {
      await putItem({
        PK: recommendationPK(event.userId),
        SK: recommendationSK(createdAt),
        ...stored,
        ...gsi1RecommendationKeys(event.userId, createdAt),
      });
      persisted.push(stored);
    } catch (err) {
      logger.warn('GenerateRecommendations: failed to persist recommendation — skipping', {
        userId: event.userId,
        title: rec.title,
        error: String(err),
      });
    }
  }

  // Sort the email subset by a confidence × time-horizon heuristic (sooner
  // and higher-confidence first). This-week recs at 0.7+ get to the top.
  const horizonWeight: Record<string, number> = {
    'this-week': 1,
    'this-month': 0.6,
    'this-quarter': 0.3,
  };
  const topRecommendations = [...persisted]
    .sort((a, b) => {
      const sa = a.confidence * (horizonWeight[a.timeHorizon] ?? 0.5);
      const sb = b.confidence * (horizonWeight[b.timeHorizon] ?? 0.5);
      return sb - sa;
    })
    .slice(0, 3);

  logger.info('GenerateRecommendations completed', {
    userId: event.userId,
    generated: recs.length,
    persisted: persisted.length,
    topForEmail: topRecommendations.length,
  });

  return { ...event, topRecommendations };
};
