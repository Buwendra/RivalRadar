/**
 * Durable fixed-window rate limiter for the public auth endpoints
 * (pre-soft-launch hardening — replaces the in-memory per-Lambda map that
 * reset on every cold start).
 *
 * One DynamoDB row per (scope, identifier) — e.g. ('SIGNIN_IP', <ip>) —
 * holding `count` + `windowResetAt`, self-cleaning via `expiresAt` TTL.
 * Race-safe via the same two-phase conditionalUpdate shape as the per-day
 * research quota in research-eligibility.ts (a plain read-modify-write
 * lets parallel requests all pass):
 *
 *   Phase 1 — ADD count, guarded by "window still live AND under limit".
 *   Phase 2 — start a fresh window (SET count=1), guarded by "no window
 *             or window expired".
 *   Both fail → live window at the limit → 429 with a computed retry-after.
 *
 * Fail-open on unexpected DDB errors (matching awaitRateLimitClearance in
 * anthropic.ts): a broken limiter must never lock everyone out of auth —
 * Cognito's own lockout/quota is the backstop.
 */

import { conditionalUpdate, getItem } from '../db/queries';
import { authRateLimitPK, authRateLimitSK } from '../db/keys';
import { HttpError } from '../middleware/handler';
import { logger } from './logger';

/** TTL slack past the window end so in-flight readers never see a vanished row. */
const TTL_SLACK_SECONDS = 600;

/**
 * Throws HttpError(429, 'RATE_LIMITED') when `identifier` has exceeded
 * `limit` calls within the current `windowSeconds` fixed window; returns
 * normally (having consumed one slot) otherwise.
 *
 * Lowercase email identifiers at the call site so "A@b.com" and "a@b.com"
 * share a window.
 */
export async function enforceAuthRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const pk = authRateLimitPK(scope, identifier);
  const sk = authRateLimitSK();
  const now = Date.now();

  try {
    // Phase 1 — consume a slot in the live window. A missing row (or missing
    // attribute) fails the condition, falling through to phase 2.
    const incremented = await conditionalUpdate({
      pk,
      sk,
      update: 'ADD #c :one',
      condition: '#w > :now AND #c <= :headroom',
      names: { '#c': 'count', '#w': 'windowResetAt' },
      values: { ':one': 1, ':now': now, ':headroom': limit - 1 },
    });
    if (incremented) return;

    // Phase 2 — no window yet, or the previous one expired: start fresh.
    const windowResetAt = now + windowSeconds * 1000;
    const started = await conditionalUpdate({
      pk,
      sk,
      update: 'SET #c = :one, #w = :fresh, #e = :ttl',
      condition: 'attribute_not_exists(#w) OR #w <= :now',
      names: { '#c': 'count', '#w': 'windowResetAt', '#e': 'expiresAt' },
      values: {
        ':one': 1,
        ':fresh': windowResetAt,
        ':now': now,
        ':ttl': Math.floor(windowResetAt / 1000) + TTL_SLACK_SECONDS,
      },
    });
    if (started) return;

    // Both phases lost: a live window is at the limit. Read it for a real
    // retry-after (best-effort — fall back to a full window on a miss).
    const row = await getItem<{ windowResetAt?: number }>(pk, sk);
    const resetAt = row?.windowResetAt ?? now + windowSeconds * 1000;
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000));
    // Deliberately no identifier in the log — scope + timing is enough for
    // observability without putting emails/IPs in a greppable metric line.
    logger.warn('auth_rate_limited', { scope, retryAfterSec });
    throw new HttpError(
      429,
      'RATE_LIMITED',
      `Too many attempts. Retry after ${retryAfterSec}s.`
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) throw err;
    // Fail-open — see module docstring.
    logger.warn('auth_rate_limit_check_failed', {
      scope,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
