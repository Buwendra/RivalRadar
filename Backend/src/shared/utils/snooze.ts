/**
 * Snooze evaluation helper (Phase 7a).
 *
 * A competitor is "currently snoozed" when:
 *   - `snoozedUntil` is set, AND
 *   - the parsed timestamp is strictly in the future (now < snoozedUntil)
 *
 * Used by aggregate-changes (filter digest), enqueue-recurring-research (skip
 * scheduling), deep-research (suppress critical alerts), and the changes-list
 * API (filter feed by default). Centralized so the comparison rule stays
 * identical across call sites.
 */

export function isSnoozed(
  competitor: { snoozedUntil?: string } | null | undefined,
  now: Date = new Date()
): boolean {
  const until = competitor?.snoozedUntil;
  if (!until) return false;
  const ms = Date.parse(until);
  if (!Number.isFinite(ms)) return false;
  return ms > now.getTime();
}
