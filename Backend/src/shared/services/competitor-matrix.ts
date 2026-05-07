/**
 * Competitor matrix row builder (Phase 19).
 *
 * Loads every competitor in a tenant and joins each one with the most recent
 * `ResearchFinding.derivedState`. Used by both `GET /competitors/matrix` (UI
 * consumption) and the `competitor-matrix` branch of `POST /exports/csv` —
 * extracting the loader avoids drift between the two surfaces.
 *
 * Volume bound: 25 competitors max (Command tier) × 1 RESEARCH#... row each
 * via Promise.all. Tens of milliseconds against on-demand DDB.
 */

import { queryByPK } from '../db/queries';
import { competitorPK, researchPK } from '../db/keys';
import type { Competitor, ResearchFinding, DerivedState } from '../types';

export interface CompetitorMatrixRow {
  id: string;
  name: string;
  url: string;
  status: Competitor['status'];
  threatLevel?: Competitor['threatLevel'];
  threatReasoning?: string;
  momentum?: Competitor['momentum'];
  momentumChangePercent?: number;
  derivedTags?: string[];
  derivedState?: DerivedState;
  latestResearchAt?: string;
}

export async function buildCompetitorMatrix(
  tenantUserId: string
): Promise<CompetitorMatrixRow[]> {
  const { items } = await queryByPK(
    competitorPK(tenantUserId),
    'COMP#',
    { scanForward: true }
  );
  const competitors = items as unknown as Competitor[];

  const rows = await Promise.all(
    competitors.map(async (c) => {
      const research = await queryByPK(
        researchPK(c.id),
        'RESEARCH#',
        { limit: 1, scanForward: false }
      );
      const latest = research.items[0] as unknown as ResearchFinding | undefined;
      return {
        id: c.id,
        name: c.name,
        url: c.url,
        status: c.status,
        threatLevel: c.threatLevel,
        threatReasoning: c.threatReasoning,
        momentum: c.momentum,
        momentumChangePercent: c.momentumChangePercent,
        derivedTags: c.derivedTags,
        derivedState: latest?.derivedState,
        latestResearchAt: latest?.generatedAt,
      } satisfies CompetitorMatrixRow;
    })
  );

  return rows;
}
