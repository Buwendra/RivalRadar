/**
 * Glue between `elevenlabs.ts` and DynamoDB / S3 for the weekly audio
 * briefing. Mirrors the battlecard PDF storage pattern at
 * `api/competitors/battlecard.ts` — same bucket, same key shape under a
 * different prefix.
 *
 * Returns a fresh 7-day presigned URL that the email + dashboard can use
 * directly. The 7-day TTL is the S3 SigV4 maximum; long enough for the
 * weekly-cadence use case.
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { putItem } from '../db/queries';
import { audioBriefingPK, audioBriefingSK } from '../db/keys';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';
import type { AudioBriefing } from '../types';

const s3 = new S3Client({});
const TTL_DAYS = 90;
const PRESIGNED_TTL_SEC = 7 * 24 * 60 * 60; // 7 days — S3 SigV4 max

export interface StoreAudioBriefingInput {
  tenantUserId: string;
  mp3: Buffer;
  charCount: number;
  durationSec: number;
}

export interface StoreAudioBriefingResult {
  id: string;
  s3Key: string;
  presignedUrl: string;
  presignedUrlExpiresAt: number;
  durationSec: number;
}

export async function storeAudioBriefing(
  input: StoreAudioBriefingInput
): Promise<StoreAudioBriefingResult> {
  const bucket = process.env.BUCKET_NAME;
  if (!bucket) {
    throw new Error('storeAudioBriefing: BUCKET_NAME env var not configured');
  }

  const id = generateId();
  const now = new Date();
  const generatedAt = now.toISOString();
  const s3Key = `audio-briefings/USER#${input.tenantUserId}/${id}.mp3`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: input.mp3,
      ContentType: 'audio/mpeg',
      ContentDisposition: `inline; filename="kironyx-briefing-${generatedAt.slice(0, 10)}.mp3"`,
      Metadata: {
        'audio-briefing-id': id,
        'tenant-user-id': input.tenantUserId,
        'generated-at': generatedAt,
        'char-count': String(input.charCount),
      },
    })
  );

  const presignedUrl = await mintPresignedUrl(bucket, s3Key);
  const presignedUrlExpiresAt = Math.floor(now.getTime() / 1000) + PRESIGNED_TTL_SEC;
  const expiresAt = Math.floor(now.getTime() / 1000) + TTL_DAYS * 24 * 60 * 60;

  const row: AudioBriefing & Record<string, unknown> = {
    id,
    tenantUserId: input.tenantUserId,
    generatedAt,
    s3Key,
    presignedUrl,
    presignedUrlExpiresAt,
    charCount: input.charCount,
    durationSec: input.durationSec,
    expiresAt,
  };
  await putItem({
    PK: audioBriefingPK(input.tenantUserId),
    SK: audioBriefingSK(generatedAt, id),
    ...row,
  });

  logger.info('audio_briefing_stored', {
    tenantUserId: input.tenantUserId,
    id,
    s3Key,
    durationSec: input.durationSec,
  });

  return {
    id,
    s3Key,
    presignedUrl,
    presignedUrlExpiresAt,
    durationSec: input.durationSec,
  };
}

/**
 * Mint a fresh 7-day presigned URL for an existing S3 key. Used by the
 * profile handler when the stored URL has expired but the underlying MP3
 * is still on the row.
 */
export async function refreshAudioBriefingUrl(s3Key: string): Promise<{
  url: string;
  expiresAt: number;
}> {
  const bucket = process.env.BUCKET_NAME;
  if (!bucket) {
    throw new Error('refreshAudioBriefingUrl: BUCKET_NAME env var not configured');
  }
  const url = await mintPresignedUrl(bucket, s3Key);
  const expiresAt = Math.floor(Date.now() / 1000) + PRESIGNED_TTL_SEC;
  return { url, expiresAt };
}

async function mintPresignedUrl(bucket: string, key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: PRESIGNED_TTL_SEC }
  );
}
