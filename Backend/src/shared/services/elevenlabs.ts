/**
 * ElevenLabs Flash TTS — narrates the weekly digest summary.
 *
 * Cost (May 2026):
 *   Flash v2.5 = $0.18 per 1,000 input characters.
 *   A 500-word briefing ≈ 3,000 chars ≈ $0.54 per generation.
 *   Gated to Strategist+ tier; ~$2/active-Strategist/month at weekly cadence.
 *
 * Failure mode: if `ELEVENLABS_API_KEY` is absent (key not added in Secrets
 * Manager yet) or the call fails for any reason, this returns `null` and
 * the caller is expected to ship the digest as text-only. We never fail
 * the digest because audio generation failed.
 */

import { getSecret, API_SECRETS_PATH } from './secrets';
import { logger } from '../utils/logger';

// "Rachel" — ElevenLabs default warm female voice. Stable choice for a
// professional briefing tone. Swappable per-workspace later if we add a
// voice-cloning tier.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const FLASH_MODEL_ID = 'eleven_flash_v2_5';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// 200 chars/sec ≈ 150 words/min ≈ a relaxed conversational pace.
const APPROX_CHARS_PER_SECOND = 16;

export interface AudioGenerationResult {
  mp3: Buffer;
  charCount: number;
  /** Approximate playback length in seconds. */
  durationSec: number;
}

export async function generateAudioBriefing(
  text: string
): Promise<AudioGenerationResult | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const secrets = await getSecret(API_SECRETS_PATH);
  const apiKey = secrets.ELEVENLABS_API_KEY;
  if (!apiKey) {
    logger.warn('elevenlabs_key_missing', {
      message: 'ELEVENLABS_API_KEY absent from kironyx/api-keys — skipping audio briefing',
    });
    return null;
  }

  try {
    const response = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${DEFAULT_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: trimmed,
          model_id: FLASH_MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.warn('elevenlabs_tts_failed', {
        status: response.status,
        body: body.slice(0, 300),
      });
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const mp3 = Buffer.from(arrayBuffer);
    const charCount = trimmed.length;
    const durationSec = Math.max(1, Math.round(charCount / APPROX_CHARS_PER_SECOND));

    logger.info('elevenlabs_tts_completed', {
      charCount,
      mp3Bytes: mp3.length,
      durationSec,
    });

    return { mp3, charCount, durationSec };
  } catch (err) {
    logger.warn('elevenlabs_tts_threw', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
