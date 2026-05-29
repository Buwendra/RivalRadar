/**
 * AudioBriefing (Phase 2 demo-wow) — Strategist+ weekly digest gets a TTS
 * narration generated via ElevenLabs Flash. MP3 lives in S3; the row stores
 * the S3 key, character count (for cost telemetry), and the latest
 * presigned URL so the email + dashboard can play it directly without
 * proxying through an API route. URL is re-minted in the profile handler if
 * the stored one expires.
 *
 * Keyed under the tenant owner's user row so all workspace members share
 * visibility, mirroring the Battlecard pattern.
 *
 *   PK = USER#<tenantUserId>
 *   SK = AUDIO#<generatedAt>#<id>
 *
 * Retention: 90 days via DynamoDB TTL (`expiresAt`). Old briefings rotate
 * naturally; we never need more than ~12 to render the "latest" card.
 */

export interface AudioBriefing {
  id: string;
  tenantUserId: string;
  /** ISO timestamp the briefing was generated. */
  generatedAt: string;
  /** S3 object key for the MP3 (e.g. `audio-briefings/USER#abc/01KSXYZ.mp3`). */
  s3Key: string;
  /** Most-recent presigned URL. Re-minted in `users/me` when expired. */
  presignedUrl: string;
  /** When `presignedUrl` expires (epoch seconds). */
  presignedUrlExpiresAt: number;
  /** Character count of the source text — drives the ElevenLabs cost calc. */
  charCount: number;
  /** Approximate playback length in seconds; computed from charCount. */
  durationSec: number;
  /** Epoch seconds — DynamoDB TTL. */
  expiresAt: number;
}
