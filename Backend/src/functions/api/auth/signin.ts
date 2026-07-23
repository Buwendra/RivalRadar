import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { apiHandler, parseBody, HttpError, PublicEvent, getSourceIp, getUserAgent } from '../../../shared/middleware/handler';
import { validate } from '../../../shared/middleware/validation';
import { enforceAuthRateLimit } from '../../../shared/utils/auth-rate-limit';
import { logger } from '../../../shared/utils/logger';
import { recordAuthAuditEvent } from '../../../shared/services/audit';
import { z } from 'zod';

const cognito = new CognitoIdentityProviderClient({});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const handler = apiHandler<PublicEvent>(async (event) => {
  const body = validate(signinSchema, parseBody(event));
  const sourceIp = getSourceIp(event);
  const userAgent = getUserAgent(event);

  // Durable brute-force limits (WAF is deferred, so this is the app-level
  // defense; Cognito's own lockout remains the backstop). Per-IP catches
  // spraying from one host; per-email catches distributed guessing against
  // one account.
  await enforceAuthRateLimit('SIGNIN_IP', sourceIp, 10, 5 * 60);
  await enforceAuthRateLimit('SIGNIN_EMAIL', body.email.toLowerCase(), 5, 15 * 60);

  logger.info('signin_attempt', { email: body.email });

  try {
    const result = await cognito.send(
      new InitiateAuthCommand({
        ClientId: process.env.USER_POOL_CLIENT_ID!,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: body.email,
          PASSWORD: body.password,
        },
      })
    );

    logger.info('signin_succeeded', { email: body.email });
    void recordAuthAuditEvent({
      action: 'auth.signin_succeeded',
      email: body.email,
      sourceIp,
      userAgent,
    });
    return {
      statusCode: 200,
      body: {
        data: {
          accessToken: result.AuthenticationResult!.AccessToken,
          idToken: result.AuthenticationResult!.IdToken,
          refreshToken: result.AuthenticationResult!.RefreshToken,
          expiresIn: result.AuthenticationResult!.ExpiresIn,
        },
      },
    };
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException')) {
      logger.info('signin_failed', { email: body.email, reason: 'invalid_credentials' });
      void recordAuthAuditEvent({
        action: 'auth.signin_failed',
        email: body.email,
        sourceIp,
        userAgent,
        meta: { reason: 'invalid_credentials' },
      });
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (err instanceof Error && err.name === 'UserNotConfirmedException') {
      logger.info('signin_failed', { email: body.email, reason: 'unconfirmed' });
      void recordAuthAuditEvent({
        action: 'auth.signin_failed',
        email: body.email,
        sourceIp,
        userAgent,
        meta: { reason: 'unconfirmed' },
      });
      throw new HttpError(403, 'UNCONFIRMED', 'Please verify your email before signing in');
    }
    void recordAuthAuditEvent({
      action: 'auth.signin_failed',
      email: body.email,
      sourceIp,
      userAgent,
      meta: { reason: 'cognito_error' },
    });
    throw err;
  }
});
