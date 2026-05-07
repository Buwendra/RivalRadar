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
  /**
   * Phase 17 — when true, every Change written by the research pipeline
   * that matches this view's filters fires a real-time webhook to the
   * workspace's webhook integration (HMAC-signed POST). Owner/admin-only
   * toggle. Default false.
   */
  webhookOnMatch?: boolean;
}

/**
 * SavedViewSubscription (Phase 15) — per-caller weekly email digest of a
 * saved view's matching changes. Stored under the SUBSCRIBER's USER# row
 * (not the tenant owner's): each member subscribes independently.
 *
 *   PK = USER#<subscriberUserId>
 *   SK = VIEW_SUB#<workspaceId>#<viewId>
 *
 * v1 is weekly + email only. Slack/webhook fan-out + daily cadence are
 * deferred to follow-up phases.
 */
export interface SavedViewSubscription {
  subscriberUserId: string;
  subscriberEmail: string;
  workspaceId: string;
  viewId: string;
  cadence: 'weekly';
  createdAt: string;
  /** Bumped after each successful digest send. Best-effort. */
  lastSentAt?: string;
}
