/**
 * Saved-view filter evaluation (Phase 7b/15/17).
 *
 * `matchesViewFilters` is a single-change predicate; `applyViewFilters` is
 * the array wrapper. Both consumers — the weekly digest cron (Phase 15)
 * and the pipeline-side webhook fan-out (Phase 17) — share this rule so
 * filter semantics stay aligned.
 *
 * Filter contract:
 *   minSignificance — change.significance >= filter
 *   competitorIds   — change.competitorId in filter list
 *   changeTypes     — aiAnalysis.changeType in filter list
 *   sinceDays       — change.detectedAt within N days from now
 *
 * Empty / undefined filter arrays are treated as "no filter" (pass-through).
 */

import type { SavedViewFilters } from '../types';

/**
 * Minimal change shape needed for filter evaluation. Both the dashboard's
 * Change type and the digest cron's flattened ChangeRow type satisfy this
 * structurally — TypeScript matches it nominally per usage.
 */
export interface FilterableChange {
  significance?: number;
  competitorId?: string;
  detectedAt?: string;
  /** Some call sites flatten changeType to the top level. */
  changeType?: string;
  /** Other call sites keep it nested under aiAnalysis. */
  aiAnalysis?: { changeType?: string } | unknown;
}

function changeTypeOf(c: FilterableChange): string | undefined {
  if (typeof c.changeType === 'string') return c.changeType;
  const ai = c.aiAnalysis as { changeType?: string } | undefined;
  return ai?.changeType;
}

export function matchesViewFilters(
  change: FilterableChange,
  filters: SavedViewFilters
): boolean {
  if (filters.minSignificance && filters.minSignificance > 0) {
    if ((change.significance ?? 0) < filters.minSignificance) return false;
  }
  if (filters.competitorIds && filters.competitorIds.length > 0) {
    if (!change.competitorId) return false;
    if (!filters.competitorIds.includes(change.competitorId)) return false;
  }
  if (filters.changeTypes && filters.changeTypes.length > 0) {
    const t = changeTypeOf(change);
    if (!t) return false;
    if (!(filters.changeTypes as string[]).includes(t)) return false;
  }
  if (filters.sinceDays && filters.sinceDays > 0) {
    const cutoffMs = Date.now() - filters.sinceDays * 24 * 60 * 60 * 1000;
    const detectedMs = change.detectedAt ? Date.parse(change.detectedAt) : NaN;
    if (!Number.isFinite(detectedMs) || detectedMs < cutoffMs) return false;
  }
  return true;
}

export function applyViewFilters<T extends FilterableChange>(
  changes: T[],
  filters: SavedViewFilters
): T[] {
  return changes.filter((c) => matchesViewFilters(c, filters));
}
