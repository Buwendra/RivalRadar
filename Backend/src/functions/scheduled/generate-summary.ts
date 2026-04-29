import { generateWeeklySummary } from '../../shared/services/anthropic';
import { getItem } from '../../shared/db/queries';
import { userPK, userSK } from '../../shared/db/keys';
import { logger } from '../../shared/utils/logger';

interface AggregatedChange {
  competitorName: string;
  pageUrl: string;
  summary: string;
  significanceScore: number;
  changeType: string;
  detectedAt: string;
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
  competitorSnapshots?: CompetitorSnapshot[];
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

  // Load user record so we can frame the briefing for THIS user (companyName + industry).
  // Best-effort: failure is logged but we still produce a generic briefing.
  let userCompanyName: string | undefined;
  let userIndustry: string | undefined;
  try {
    const userRecord = await getItem<Record<string, unknown>>(
      userPK(event.userId),
      userSK()
    );
    userCompanyName = (userRecord?.companyName as string | undefined) ?? undefined;
    userIndustry = (userRecord?.industry as string | undefined) ?? undefined;
  } catch (err) {
    logger.warn('GenerateSummary: failed to load user record — falling back to generic briefing', {
      userId: event.userId,
      error: String(err),
    });
  }

  const summary = await generateWeeklySummary({
    changes: event.topChanges,
    userCompanyName,
    userIndustry,
    competitorSnapshots: event.competitorSnapshots,
  });

  logger.info('GenerateSummary completed', {
    userId: event.userId,
    changesAnalyzed: event.topChanges.length,
    hadUserContext: Boolean(userCompanyName || userIndustry),
    competitorSnapshotsCount: event.competitorSnapshots?.length ?? 0,
  });

  return { ...event, strategicSummary: summary };
};
