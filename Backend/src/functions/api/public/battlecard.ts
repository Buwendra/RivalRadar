/**
 * GET /public/battlecards/{token}
 *
 * Phase 20 — public share endpoint. No auth. Resolves the share token via
 * GSI3, validates TTL + revocation, then 302-redirects to a fresh 1-hour
 * S3 presigned URL. The PDF opens inline in the browser.
 *
 * Written without `apiHandler()` because the wrapper hardcodes
 * `Content-Type: application/json` headers and we need a `Location:` header
 * for the 302. Logs every hit for forensic visibility.
 *
 * Failure modes:
 *   404 NOT_FOUND  — token doesn't exist
 *   410 GONE       — revoked or TTL elapsed
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';
import { queryGSI } from '../../../shared/db/queries';
import { logger } from '../../../shared/utils/logger';
import type { Battlecard } from '../../../shared/types';

const s3 = new S3Client({});
const PRESIGNED_TTL_SEC = 60 * 60; // 1 hour

const ALLOWED_ORIGIN = process.env.FRONTEND_URL ?? '*';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

function jsonError(
  statusCode: number,
  code: string,
  message: string
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: { code, message } }),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> {
  logger.info('public_battlecard_request', {
    requestId: context.awsRequestId,
    path: event.requestContext.http.path,
  });

  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const token = event.pathParameters?.token;
  if (!token) {
    return jsonError(400, 'MISSING_TOKEN', 'Token is required');
  }

  try {
    const { items } = await queryGSI(
      'GSI3',
      'GSI3PK',
      `BATTLECARD_TOKEN#${token}`
    );
    if (items.length === 0) {
      return jsonError(404, 'NOT_FOUND', 'Battlecard not found.');
    }
    const row = items[0] as unknown as Battlecard;

    if (row.revokedAt) {
      return jsonError(410, 'REVOKED', 'This battlecard has been revoked.');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof row.expiresAt === 'number' && row.expiresAt < nowSec) {
      return jsonError(410, 'EXPIRED', 'This battlecard has expired.');
    }

    const bucket = process.env.BUCKET_NAME;
    if (!bucket) {
      return jsonError(500, 'CONFIG_ERROR', 'Storage bucket not configured');
    }

    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: row.s3Key }),
      { expiresIn: PRESIGNED_TTL_SEC }
    );

    logger.info('battlecard_public_hit', {
      battlecardId: row.id,
      competitorId: row.competitorId,
      tenantUserId: row.tenantUserId,
      sourceIp: event.requestContext.http.sourceIp ?? 'unknown',
      userAgent:
        (event.headers as Record<string, string | undefined>)['user-agent'] ??
        'unknown',
    });

    return {
      statusCode: 302,
      headers: { ...CORS_HEADERS, Location: downloadUrl },
      body: '',
    };
  } catch (err) {
    logger.error('public_battlecard_failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
}
