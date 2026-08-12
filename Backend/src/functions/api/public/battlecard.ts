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
import { getItem, queryGSI } from '../../../shared/db/queries';
import { corsHeaders } from '../../../shared/middleware/handler';
import { logger } from '../../../shared/utils/logger';
import type { Battlecard } from '../../../shared/types';

const s3 = new S3Client({});
const PRESIGNED_TTL_SEC = 60 * 60; // 1 hour

function jsonError(
  cors: Record<string, string>,
  statusCode: number,
  code: string,
  message: string
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { ...cors, 'Content-Type': 'application/json' },
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

  const cors = corsHeaders(event);

  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  const token = event.pathParameters?.token;
  if (!token) {
    return jsonError(cors, 400, 'MISSING_TOKEN', 'Token is required');
  }

  try {
    // GSI3 has a KEYS_ONLY projection — the query gives us PK + SK + GSI keys
    // only. Follow up with a base-table getItem to fetch the full row
    // (s3Key, revokedAt, expiresAt, etc.).
    const { items } = await queryGSI(
      'GSI3',
      'GSI3PK',
      `BATTLECARD_TOKEN#${token}`
    );
    if (items.length === 0) {
      return jsonError(cors, 404, 'NOT_FOUND', 'Battlecard not found.');
    }
    const stub = items[0] as { PK?: string; SK?: string };
    if (!stub.PK || !stub.SK) {
      return jsonError(cors, 404, 'NOT_FOUND', 'Battlecard not found.');
    }
    const row = await getItem<Battlecard>(stub.PK, stub.SK);
    if (!row) {
      return jsonError(cors, 404, 'NOT_FOUND', 'Battlecard not found.');
    }

    if (row.revokedAt) {
      return jsonError(cors, 410, 'REVOKED', 'This battlecard has been revoked.');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof row.expiresAt === 'number' && row.expiresAt < nowSec) {
      return jsonError(cors, 410, 'EXPIRED', 'This battlecard has expired.');
    }

    const bucket = process.env.BUCKET_NAME;
    if (!bucket) {
      return jsonError(cors, 500, 'CONFIG_ERROR', 'Storage bucket not configured');
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
      headers: { ...cors, Location: downloadUrl },
      body: '',
    };
  } catch (err) {
    logger.error('public_battlecard_failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return jsonError(cors, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
}
