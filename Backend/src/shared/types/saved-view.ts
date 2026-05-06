/**
 * SavedView (Phase 7b)
 *
 * Named filter combination for the change feed. Stored under the tenant
 * owner's `USER#<id>` so all workspace members share the same view library.
 * Tier-gated via `Capabilities.savedViews.max` — Scout 0, Strategist 5,
 * Command 25.
 */

import type { ChangeType } from './index';

export interface SavedViewFilters {
  /** Hide changes below this significance (0-10). 0 = no filter. */
  minSignificance?: number;
  /** Restrict to specific competitors. Empty = all competitors. */
  competitorIds?: string[];
  /** Restrict to specific change types (pricing/feature/...). Empty = all. */
  changeTypes?: ChangeType[];
  /** Last N days. Undefined = no time bound. */
  sinceDays?: number;
}

export interface SavedView {
  id: string;
  name: string;
  filters: SavedViewFilters;
  /** Caller (member) who created the view — for attribution. */
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}
