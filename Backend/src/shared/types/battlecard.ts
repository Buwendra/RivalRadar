/**
 * Battlecard entity (Phase 20).
 *
 * Per-competitor sales-enablement PDF, generated on demand. Each row holds
 * one S3 key + one public share token (ULID); rows TTL after 30 days. The
 * public token is GSI3-indexed via PK=`BATTLECARD_TOKEN#${token}` so the
 * unauthenticated `GET /public/battlecards/{token}` endpoint can resolve it
 * with a single GSI query.
 *
 * Tier-gated on `pdfExports` (same as the Phase 6b weekly briefing) — no
 * new capability flag introduced.
 */

export interface Battlecard {
  id: string;
  competitorId: string;
  competitorName: string;
  /** Workspace owner's userId — entity is keyed under this. */
  tenantUserId: string;
  /** The actual user who clicked "Generate" (may be a workspace member, not the owner). */
  createdByUserId: string;
  createdByEmail: string;
  publicToken: string;
  s3Key: string;
  filename: string;
  pdfBytes: number;
  /** Epoch seconds — 30-day TTL; row auto-expires from DDB. */
  expiresAt: number;
  createdAt: string;
  /** Soft-revoke marker. Public endpoint returns 410 GONE if set. */
  revokedAt?: string;
}
