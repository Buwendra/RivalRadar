/**
 * Per-minute token bucket for the Anthropic org-level input-TPM limit
 * (Issue 8 — currently 30k input tokens/min). Pre-call writes to this row
 * with a fire-and-forget atomic ADD; the read in the same callAnthropic
 * invocation checks the running total against a 25k threshold (5k
 * headroom under the actual limit).
 *
 *   PK = RATELIMIT#ANTHROPIC_INPUT_TPM
 *   SK = MINUTE#<YYYY-MM-DDTHH:MM>
 *
 * TTL: 2 minutes via `expiresAt`. Old buckets clean up automatically.
 */

export interface RateLimitBucket {
  /** ISO truncated to minute, e.g. `2026-06-02T14:32`. */
  minute: string;
  /** Atomic-ADD counter of estimated input tokens consumed in this minute. */
  tokensUsed: number;
  /** Epoch seconds — DynamoDB TTL. */
  expiresAt: number;
}
