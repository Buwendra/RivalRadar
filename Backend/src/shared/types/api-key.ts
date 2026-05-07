/**
 * ApiKey (Phase 11) — workspace-scoped public API credential.
 *
 * Stored as TWO rows (mirrors the Membership double-write pattern):
 *
 *   1. Auth-lookup row (read on every authenticated /v1/* request):
 *      PK = APIKEY#<sha256(plaintext)>, SK = META
 *
 *   2. Workspace mirror (read by `GET /workspaces/current/api-keys`):
 *      PK = WORKSPACE#<wsId>, SK = APIKEY#<id>
 *
 * Both rows carry the same fields. Plaintext is returned ONCE on creation
 * and never persisted; only the sha256 hash + a 4-char hint live at rest.
 *
 * Per-key minute throttle is a tiny rate-limit window written back to the
 * auth-lookup row on every successful request. Best-effort — a write
 * failure doesn't block the response.
 */

export type ApiKeyScope = 'read' | 'write';

export interface ApiKey {
  id: string;                  // ULID
  workspaceId: string;
  tenantUserId: string;        // immutable copy from Workspace.tenantUserId
  name: string;                // user-supplied label
  keyHash: string;             // sha256(plaintext) hex — ONLY in auth-lookup row's PK
  keyHint: string;             // last 4 chars of plaintext (e.g. "4f8c")
  createdByUserId: string;
  createdAt: string;
  lastUsedAt?: string;
  disabled?: boolean;
  /**
   * Phase 13 — capability scope. 'read' (default) hits /v1 GETs only.
   * 'write' is a superset and unlocks POST /v1/competitors,
   * PATCH /v1/competitors/{id}/snooze, PATCH /v1/recommendations/{id}.
   * Optional in the type to support pre-Phase-13 rows; resolver falls
   * back to 'read'.
   */
  scope?: ApiKeyScope;
  /** Per-key requests/min cap. Default 60. */
  quotaPerMinute: number;
  /** Sliding 60s counter — written on every authenticated request. */
  requestCount?: number;
  /** Epoch ms when the current counter window resets. */
  windowResetAt?: number;
}
