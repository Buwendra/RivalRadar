/**
 * Phase 23 — Brand Pulse. Helpers for the discriminated Competitor row.
 *
 * Self-brand rows (`targetKind === 'self'`) live alongside competitor rows
 * under the same `USER#<tenantId>` PK + `COMP#<id>` SK prefix. Every list
 * endpoint that surfaces "the workspace's competitors" must filter them out;
 * the few endpoints that operate over every COMP row (account delete, GDPR
 * export) deliberately do NOT filter — they want both kinds.
 */

/** True when the row represents a tracked competitor (default for legacy rows). */
export function isCompetitorTarget(row: { targetKind?: unknown } | null | undefined): boolean {
  if (!row) return false;
  return row.targetKind !== 'self';
}

/** True when the row represents the workspace's own brand. */
export function isSelfBrandTarget(row: { targetKind?: unknown } | null | undefined): boolean {
  if (!row) return false;
  return row.targetKind === 'self';
}

/** Filter helper for list responses. Preserves order. */
export function competitorsOnly<T extends { targetKind?: unknown }>(rows: T[]): T[] {
  return rows.filter(isCompetitorTarget);
}
