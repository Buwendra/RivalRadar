import {
  CognitoIdentityProviderClient,
  ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { apiHandler, parseBody, HttpError, PublicEvent, getSourceIp } from '../../../shared/middleware/handler';
import { validate } from '../../../shared/middleware/validation';
import { enforceAuthRateLimit } from '../../../shared/utils/auth-rate-limit';
import { logger } from '../../../shared/utils/logger';

const cognito = new CognitoIdentityProviderClient({});

const resendSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /auth/resend-verification
 *
 * Public route. Re-sends the Cognito confirmation email for an unconfirmed
 * account. Durably rate-limited (DynamoDB-backed, survives cold starts):
 * per-email 3/hour so nobody can email-bomb one inbox, per-IP 10/hour so
 * one host can't spray many addresses. Cognito's LimitExceededException
 * remains the backstop. Returns 200 even when the email is unknown so we
 * don't leak account existence.
 */
export const handler = apiHandler<PublicEvent>(async (event) => {
  const body = validate(resendSchema, parseBody(event));

  await enforceAuthRateLimit('RESEND_EMAIL', body.email.toLowerCase(), 3, 60 * 60);
  await enforceAuthRateLimit('RESEND_IP', getSourceIp(event), 10, 60 * 60);

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
