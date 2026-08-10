import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

/** Event type for authenticated routes (Cognito JWT authorizer) */
export type AuthenticatedEvent = APIGatewayProxyEventV2WithJWTAuthorizer;
/** Event type for public routes (no authorizer) */
export type PublicEvent = APIGatewayProxyEventV2;

type HandlerFn<E = AuthenticatedEvent | PublicEvent> = (
  event: E,
  context: Context
) => Promise<{ statusCode: number; body: ApiResponse<unknown> }>;

/** Origins allowed to call this API. `ALLOWED_ORIGINS` is comma-separated
 *  (kironyx.com, www, the amplifyapp URL); `FRONTEND_URL` is the single-origin
 *  fallback and stays the canonical origin for email links. Parsed per call —
 *  trivially cheap, and it keeps the function testable under env changes. */
function allowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? '';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Per-request CORS headers. `allowCredentials: true` forbids `*`, and a
 * static header can only name ONE origin — so with multiple allowed origins
 * (kironyx.com + www + amplifyapp) we must echo the caller's origin when it
 * is allow-listed, falling back to the primary origin otherwise.
 *
 * Keep in sync with the gateway-level corsPreflight in lib/stacks/api.stack.ts
 * — API Gateway answers preflights first, but this list must not silently
 * drift behind it (it bites anyone testing the Lambda directly or changing
 * the gateway config).
 */
export function corsHeaders(event: {
  headers?: Record<string, string | undefined>;
}): Record<string, string> {
  const origins = allowedOrigins();
  // API Gateway v2 lowercases header keys; the title-case fallback covers
  // mocked/local-test events.
  const requestOrigin = event.headers?.origin ?? event.headers?.Origin;
  const origin =
    requestOrigin && origins.includes(requestOrigin) ? requestOrigin : origins[0] ?? '';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers':
      'Content-Type,Authorization,X-Idempotency-Key,X-Workspace-Id,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    // The response now varies by request origin — caches must key on it.
    Vary: 'Origin',
  };
}

/**
 * Lambda handler wrapper that provides:
 * - CORS headers
 * - JSON parsing/serialization
 * - Structured error handling
 * - Request logging
 */
export function apiHandler<E extends AuthenticatedEvent | PublicEvent = AuthenticatedEvent>(fn: HandlerFn<E>) {
  return async (
    event: E,
    context: Context
  ): Promise<APIGatewayProxyResultV2> => {
    logger.info('Request', {
      method: event.requestContext.http.method,
      path: event.requestContext.http.path,
      requestId: context.awsRequestId,
    });

    const cors = corsHeaders(event);

    // Handle preflight
    if (event.requestContext.http.method === 'OPTIONS') {
      return { statusCode: 204, headers: cors, body: '' };
    }

    try {
      const result = await fn(event, context);
      return {
        statusCode: result.statusCode,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify(result.body),
      };
    } catch (err) {
      const error = toApiError(err);
      logger.error('Unhandled error', { error });

      return {
        statusCode: error.statusCode,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: { code: error.code, message: error.message } }),
      };
    }
  };
}

/** Extract userId (Cognito sub) from JWT claims */
export function getUserId(event: AuthenticatedEvent): string {
  const claims = event.requestContext.authorizer.jwt.claims;
  if (!claims.sub) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing authentication');
  }
  return claims.sub as string;
}

/** Extract email from JWT claims */
export function getUserEmail(event: AuthenticatedEvent): string {
  const claims = event.requestContext.authorizer.jwt.claims;
  const email = claims.email as string | undefined;
  if (!email) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing email claim');
  }
  return email.toLowerCase();
}

/**
 * Phase 4b — caller IP for audit-event attribution. Returns 'unknown' if the
 * proxy event omitted it. API Gateway v2 always populates this in practice.
 */
export function getSourceIp(event: AuthenticatedEvent | PublicEvent): string {
  return event.requestContext.http.sourceIp ?? 'unknown';
}

/**
 * Phase 4b — caller User-Agent for audit-event attribution. Header keys come
 * lowercased from API Gateway v2; fall back to the title-cased form for
 * mocked / local-test events.
 */
export function getUserAgent(event: AuthenticatedEvent | PublicEvent): string {
  const headers = event.headers as Record<string, string | undefined>;
  return headers['user-agent'] ?? headers['User-Agent'] ?? 'unknown';
}

/** Parse and validate JSON body from event */
export function parseBody<T>(event: AuthenticatedEvent | PublicEvent): T {
  if (!event.body) {
    throw new HttpError(400, 'MISSING_BODY', 'Request body is required');
  }
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) as T;
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }
}

// ─── Error Classes ───

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, string>
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function toApiError(err: unknown): { statusCode: number; code: string; message: string } {
  if (err instanceof HttpError) {
    return { statusCode: err.statusCode, code: err.code, message: err.message };
  }
  // Duck-typed 4xx errors from layers below the middleware (e.g. the DB
  // helpers' InvalidCursorError) — they carry statusCode/code but can't
  // import HttpError without inverting the layering.
  if (
    err instanceof Error &&
    typeof (err as { statusCode?: unknown }).statusCode === 'number' &&
    typeof (err as { code?: unknown }).code === 'string'
  ) {
    const shaped = err as Error & { statusCode: number; code: string };
    if (shaped.statusCode >= 400 && shaped.statusCode < 500) {
      return { statusCode: shaped.statusCode, code: shaped.code, message: shaped.message };
    }
  }
  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
}
