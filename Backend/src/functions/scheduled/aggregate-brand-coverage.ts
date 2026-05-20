/**
 * Phase 24 — Comparative Briefing pipeline step 1.
 *
 * For a single subscriber, pulls everything the briefing generator needs:
 *  - the self-brand row (name, latest research summary, momentum, tags)
 *  - self-brand mention count + sentiment breakdown for the last 7 days
 *  - top-5 competitor mention counts for the last 7 days
 *  - per-category SoV showing where the brand ranks vs competitors
 *
 * Best-effort: if anything goes wrong, returns a payload with empty data so
 * the next step still has something to render (the comparative briefing then
 * degrades to "no significant coverage this week").
 */

import { queryByPK, queryGSI } from '../../shared/db/queries';
import { competitorPK, userPK, userSK } from '../../shared/db/keys';
import { getItem } from '../../shared/db/queries';
import { computeShareOfVoice, type SoVEntity } from '../../shared/utils/share-of-voice';
import type { User, ResearchCategory, ResearchFinding, FindingItem } from '../../shared/types';
import { logger } from '../../shared/utils/logger';

const WINDOW_DAYS = 7;

interface Event {
  userId: string;
  email: string;
  name: string;
  plan: string;
}

export interface ComparativeBriefingPayload {
  userId: string;
  email: string;
  name: string;
  plan: string;
  userCompanyName: string;
  userIndustry?: string;
  brand: {
    name: string;
    mentions7d: number;
    sentiment: { positive: number; neutral: number; negative: number };
    momentum?: string;
    derivedTags?: string[];
    latestSummary?: string;
  };
  competitors: Array<{
    name: string;
    mentions7d: number;
    momentum?: string;
    threatLevel?: string;
    topTags?: string[];
  }>;
  sovByCategory: Record<string, { percent: number; rank: number; outOf: number }>;
}

export const handler = async (event: Event): Promise<ComparativeBriefingPayload> => {
  const fallback = (): ComparativeBriefingPayload => ({
    userId: event.userId,
    email: event.email,
    name: event.name,
    plan: event.plan,
    userCompanyName: event.name,
    brand: {
      name: event.name,
      mentions7d: 0,
      sentiment: { positive: 0, neutral: 0, negative: 0 },
    },
    competitors: [],
    sovByCategory: {},
  });

  try {
    const [userRecord, rowsRes, changesRes] = await Promise.all([
      getItem<User & Record<string, unknown>>(userPK(event.userId), userSK()),
      queryByPK(competitorPK(event.userId), 'COMP#'),
      queryGSI('GSI1', 'GSI1PK', event.userId, 'CHANGE#', {
        skName: 'GSI1SK',
        limit: 1000,
        scanForward: false,
      }),
    ]);

    if (!userRecord) {
      logger.warn('aggregate-brand-coverage: user record missing', { userId: event.userId });
      return fallback();
    }

    const allRows = rowsRes.items;
    const selfRow = allRows.find((r) => r.targetKind === 'self');
    if (!selfRow) {
      logger.info('aggregate-brand-coverage: no self-brand row, skipping', {
        userId: event.userId,
      });
      return fallback();
    }

    const competitorRows = allRows.filter((r) => r.targetKind !== 'self');

    const cutoffMs = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentChanges = changesRes.items.filter((c) => {
      const ts = Date.parse((c.detectedAt as string) ?? '');
      return !isNaN(ts) && ts >= cutoffMs;
    });

    // Brand mention count (changes whose competitorId == self.id)
    const brandMentions = recentChanges.filter((c) => c.competitorId === selfRow.id);

    // Sentiment breakdown — load up to 4 most-recent self-brand research findings.
    const selfId = selfRow.id as string;
    const { items: findings } = await queryByPK(`COMP#${selfId}`, 'RESEARCH#', { limit: 4 });
    const sentiment = { positive: 0, neutral: 0, negative: 0 };
    for (const f of findings as unknown as ResearchFinding[]) {
      const ts = Date.parse(f.generatedAt);
      if (isNaN(ts) || ts < cutoffMs) continue;
      const cats = (f.categories ?? {}) as Partial<Record<ResearchCategory, FindingItem[]>>;
      for (const items of Object.values(cats)) {
        for (const item of items ?? []) {
          if (item.sentiment === 'positive') sentiment.positive++;
          else if (item.sentiment === 'negative') sentiment.negative++;
          else if (item.sentiment === 'neutral') sentiment.neutral++;
        }
      }
    }

    const latestSummary = ((findings[0]?.summary as string | undefined) ?? '').slice(0, 600);

    // Top-N competitor mentions
    const compCounts = new Map<string, number>();
    for (const c of recentChanges) {
      const cid = c.competitorId as string;
      if (!cid || cid === selfId) continue;
      compCounts.set(cid, (compCounts.get(cid) ?? 0) + 1);
    }
    const competitorRowsById = new Map(competitorRows.map((r) => [r.id as string, r]));
    const competitors = Array.from(compCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count]) => {
        const row = competitorRowsById.get(id);
        return {
          name: (row?.name as string) ?? 'Unknown',
          mentions7d: count,
          momentum: row?.momentum as string | undefined,
          threatLevel: row?.threatLevel as string | undefined,
          topTags: ((row?.derivedTags as string[] | undefined) ?? []).slice(0, 4),
        };
      });

    // SoV per category — find the self row's rank + percent in each.
    const entities: SoVEntity[] = allRows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      isSelf: r.targetKind === 'self',
    }));
    const sovResult = computeShareOfVoice({
      entities,
      changes: recentChanges.map((c) => ({
        competitorId: (c.competitorId as string) ?? '',
        sourceCategory: c.sourceCategory as string | undefined,
        detectedAt: (c.detectedAt as string) ?? '',
      })),
      windowDays: WINDOW_DAYS,
    });
    const sovByCategory: Record<string, { percent: number; rank: number; outOf: number }> = {};
    for (const [cat, rows] of Object.entries(sovResult.byCategory)) {
      const selfIdx = rows.findIndex((r) => r.isSelf);
      if (selfIdx === -1) continue;
      sovByCategory[cat] = {
        percent: rows[selfIdx].percent,
        rank: selfIdx + 1,
        outOf: rows.length,
      };
    }

    return {
      userId: event.userId,
      email: event.email,
      name: event.name,
      plan: event.plan,
      userCompanyName:
        (userRecord.companyName as string | undefined) ?? (selfRow.name as string),
      userIndustry: userRecord.industry as string | undefined,
      brand: {
        name: selfRow.name as string,
        mentions7d: brandMentions.length,
        sentiment,
        momentum: selfRow.momentum as string | undefined,
        derivedTags: ((selfRow.derivedTags as string[] | undefined) ?? []).slice(0, 6),
        latestSummary,
      },
      competitors,
      sovByCategory,
    };
  } catch (err) {
    logger.error('aggregate-brand-coverage failed — degrading to empty payload', {
      userId: event.userId,
      error: String(err),
    });
    return fallback();
  }
};
