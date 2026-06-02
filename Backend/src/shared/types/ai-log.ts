/**
 * Forensic audit log for every Anthropic API call (Issue 9 — Compliance
 * Phase 1.5). Per-call row with the truncated response text so we can
 * reconstruct what Claude actually generated if a defamation or accuracy
 * claim ever surfaces.
 *
 *   PK = AILOG#<YYYY-MM>            (monthly bucketed for cheap scans)
 *   SK = CALL#<ISO timestamp>#<aiCallId>
 *
 * Retention: 1 year via DynamoDB TTL (`expiresAt`). Costs ~$1.50/year at
 * 1000 calls/day; trivial compared to the legal value.
 *
 * Privacy: prompt is hashed (not stored verbatim) — same convention as
 * the existing `ai_call_completed` log line. Response text IS stored
 * (truncated to 4kb) because the response is what could defame; the
 * prompt isn't user-supplied.
 */

export interface AILog {
  /** Same aiCallId from the `ai_call_completed` log line — joins by ID. */
  aiCallId: string;
  /** Operation name (e.g. `deepResearch`, `scoreCompetitorThreat`). */
  opName: string;
  /** Model used (e.g. `claude-sonnet-4-5`, `claude-haiku-4-5-20251001`). */
  model: string;
  /** Workspace owner the call was made for (null for system tasks). */
  userId?: string | null;
  /** sha256 first 16 hex of the prompt; never the plaintext. */
  promptHash: string;
  /**
   * First 4096 chars of the response body. Stored verbatim — the response
   * is what defamation claims target. Bounded to keep rows DDB-cheap.
   */
  responseTextTruncated: string;
  /** `ok` | `http-error` | `parse-error` — matches the log-line shape. */
  status: string;
  /** HTTP status code; 200/4xx/5xx as observed. */
  httpStatus: number;
  /** Wall-clock duration in ms. */
  durationMs: number;
  /** Tokens billed (from response.usage). */
  inputTokens: number;
  outputTokens: number;
  /** Cost in USD, derived from `computeAnthropicCostUsd`. */
  costUsd: number;
  /** ISO timestamp of when the call completed. */
  createdAt: string;
  /** Epoch seconds — DynamoDB TTL. 1 year from createdAt. */
  expiresAt: number;
}
