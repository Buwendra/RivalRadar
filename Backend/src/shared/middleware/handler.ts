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

const ALLOWED_ORIGIN = process.env.FRONTEND_URL!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Idempotency-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

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

    // Handle preflight
    if (event.requestContext.http.method === 'OPTIONS') {
      return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

    try {
      const result = await fn(event, context);
      return {
        statusCode: result.statusCode,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(result.body),
      };
    } catch (err) {
      const error = toApiError(err);
      logger.error('Unhandled error', { error });

      return {
        statusCode: error.statusCode,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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
  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
}
