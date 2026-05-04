import {
  CognitoIdentityProviderClient,
  ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { apiHandler, parseBody, HttpError, PublicEvent } from '../../../shared/middleware/handler';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';

const cognito = new CognitoIdentityProviderClient({});

const resendSchema = z.object({
  email: z.string().email(),
});

/**
 * Per-Lambda-instance rate limit: 3 attempts per email per hour. Lambda cold
 * starts reset the map (intentional — pre-launch with low traffic this is
 * fine, and Cognito's own LimitExceededException is the real backstop).
 * Phase 9's API Gateway throttling will subsume this with proper guarantees.
 */
const ATTEMPTS = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 3;

function checkRateLimit(email: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const recent = (ATTEMPTS.get(email) ?? []).filter((ts) => now - ts < WINDOW_MS);
  if (recent.length >= MAX_PER_HOUR) {
    const oldest = Math.min(...recent);
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  ATTEMPTS.set(email, recent);
  return { ok: true };
}

/**
 * POST /auth/resend-verification
 *
 * Public route. Re-sends the Cognito confirmation email for an unconfirmed
 * account. Rate-limited per-email at 3/hour to prevent abuse + protect
 * Cognito's own quota. Returns 200 even when the email is unknown so we
 * don't leak account existence.
 */
export const handler = apiHandler<PublicEvent>(async (event) => {
  const body = validate(resendSchema, parseBody(event));

  const limit = checkRateLimit(body.email);
  if (!limit.ok) {
    throw new HttpError(
      429,
      'RATE_LIMITED',
      `Too many resend attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minute(s).`
    );
  }

  try {
    await cognito.send(
      new ResendConfirmationCodeCommand({
        ClientId: process.env.USER_POOL_CLIENT_ID!,
        Username: body.email,
      })
    );
    logger.info('verification_resent', { email: body.email });
    return {
      statusCode: 200,
      body: { data: { message: 'Verification email sent. Please check your inbox.' } },
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      // Don't leak whether the account exists; "user not found" looks the same as success.
      if (err.name === 'UserNotFoundException') {
        return {
          statusCode: 200,
          body: { data: { message: 'Verification email sent. Please check your inbox.' } },
        };
      }
      // Already verified — surface a useful message instead of a generic error.
      if (err.name === 'InvalidParameterException' && err.message.includes('CONFIRMED')) {
        throw new HttpError(
          409,
          'ALREADY_VERIFIED',
          'This account is already verified. Try signing in instead.'
        );
      }
      if (err.name === 'LimitExceededException') {
        throw new HttpError(
          429,
          'RATE_LIMITED',
          'Too many attempts. Please wait a few minutes before trying again.'
        );
      }
    }
    throw err;
  }
});
