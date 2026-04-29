import { apiHandler, getUserEmail, HttpError } from '../../../shared/middleware/handler';
import { queryByPK, queryGSI, getItem } from '../../../shared/db/queries';
import { competitorPK, competitorSK } from '../../../shared/db/keys';
import { computeMomentum } from '../../../shared/utils/competitor-metrics';

interface StatsInput {
  detectedAt: string;
  pageUrl?: string;
  significance: number;
  aiAnalysis?: { changeType?: string };
}

interface CompetitorStats {
  changes7d: number;
  changes30d: number;
  highSignificance30d: number;
  lastChangeAt: string | null;
  lastResearchAt: string | null;
  changesByPage: Record<string, number>;
  changesByType: Record<string, number>;
  changesByDay: Array<{ date: string; count: number }>;
}

function isoDayKey(d: Date): string {
  // YYYY-MM-DD in UTC, keyed for bucketing
  return d.toISOString().slice(0, 10);
}

function inferPageType(pageUrl: string | undefined, pagesToTrack: string[]): string {
  if (!pageUrl) return 'homepage';
  const path = (() => {
    try {
      return new URL(pageUrl).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();
  for (const page of pagesToTrack) {
    if (page === 'homepage') continue;
    if (path.includes(`/${page}`)) return page;
  }
  return 'homepage';
}

function computeStats(
  changes: StatsInput[],
  pagesToTrack: string[],
  lastResearchAt: string | null,
  now: Date
): CompetitorStats {
  const dayMs = 24 * 60 * 60 * 1000;
  const cutoff7 = now.getTime() - 7 * dayMs;
  const cutoff30 = now.getTime() - 30 * dayMs;

  // Build 30-day zero-filled bucket (oldest first, newest last)
  const changesByDay: Array<{ date: string; count: number }> = [];
  const dayIndex: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * dayMs);
    const key = isoDayKey(d);
    dayIndex[key] = changesByDay.length;
    changesByDay.push({ date: key, count: 0 });
  }

  let changes7d = 0;
  let changes30d = 0;
  let highSignificance30d = 0;
  let lastChangeAt: string | null = null;
  const changesByPage: Record<string, number> = {};
  const changesByType: Record<string, number> = {};

  for (const page of pagesToTrack) changesByPage[page] = 0;

  for (const c of changes) {
    const ts = Date.parse(c.detectedAt);
    if (isNaN(ts)) continue;

    if (!lastChangeAt || c.detectedAt > lastChangeAt) lastChangeAt = c.detectedAt;

    if (ts >= cutoff30) {
      changes30d++;
      if (typeof c.significance === 'number' && c.significance >= 7) highSignificance30d++;
      if (ts >= cutoff7) changes7d++;

      const page = inferPageType(c.pageUrl, pagesToTrack);
      changesByPage[page] = (changesByPage[page] ?? 0) + 1;

      const type = c.aiAnalysis?.changeType ?? 'content';
      changesByType[type] = (changesByType[type] ?? 0) + 1;

      const bucketKey = isoDayKey(new Date(ts));
      const idx = dayIndex[bucketKey];
      if (idx !== undefined) changesByDay[idx].count++;
    }
  }

  return {
    changes7d,
    changes30d,
    highSignificance30d,
    lastChangeAt,
    lastResearchAt,
    changesByPage,
    changesByType,
    changesByDay,
  };
}

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const compId = event.pathParameters?.id;

  if (!compId) throw new HttpError(400, 'MISSING_ID', 'Competitor ID is required');

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  const competitor = await getItem<Record<string, unknown>>(competitorPK(userId), competitorSK(compId));
  if (!competitor) {
    throw new HttpError(404, 'NOT_FOUND', 'Competitor not found');
  }

  const [{ items: changes }, { items: research }] = await Promise.all([
    queryByPK(`COMP#${compId}`, 'CHANGE#', { limit: 30 }),
    queryByPK(`COMP#${compId}`, 'RESEARCH#', { limit: 10 }),
  ]);

  const pagesToTrack = (competitor.pagesToTrack as string[]) ?? [];
  const lastResearchAt =
    research.length > 0 ? ((research[0].generatedAt as string | undefined) ?? null) : null;

  const stats = computeStats(
    changes.map((c) => ({
      detectedAt: c.detectedAt as string,
      pageUrl: c.pageUrl as string | undefined,
      significance: c.significance as number,
      aiAnalysis: c.aiAnalysis as { changeType?: string } | undefined,
    })),
    pagesToTrack,
    lastResearchAt,
    new Date()
  );

  const { momentum, momentumChangePercent } = computeMomentum({
    changesByDay: stats.changesByDay,
  });

  return {
    statusCode: 200,
    body: {
      data: {
        id: competitor.id,
        name: competitor.name,
        url: competitor.url,
        pagesToTrack: competitor.pagesToTrack,
        status: competitor.status,
        createdAt: competitor.createdAt,
        momentum,
        momentumChangePercent,
        momentumAsOf: new Date().toISOString(),
        threatLevel: competitor.threatLevel,
        threatReasoning: competitor.threatReasoning,
        threatAsOf: competitor.threatAsOf,
        derivedTags: competitor.derivedTags,
        derivedTagsAsOf: competitor.derivedTagsAsOf,
        predictedMoves: competitor.predictedMoves,
        predictedMovesAsOf: competitor.predictedMovesAsOf,
        recentChanges: changes.map((c) => ({
          id: c.id,
          significance: c.significance,
          pageUrl: c.pageUrl,
          aiAnalysis: c.aiAnalysis,
          detectedAt: c.detectedAt,
        })),
        recentResearch: research.map((r) => ({
          id: r.id,
          competitorId: r.competitorId,
          userId: r.userId,
          generatedAt: r.generatedAt,
          summary: r.summary,
          categories: r.categories,
          citations: r.citations,
          searchQueries: r.searchQueries,
          tokensUsed: r.tokensUsed,
        })),
        stats,
      },
    },
  };
});
