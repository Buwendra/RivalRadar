/**
 * POST /auth/refresh — exchange a Cognito refresh token for fresh id/access
 * tokens, so sessions survive past the 1-hour id-token validity instead of
 * hard-logging the user out mid-task.
 *
 * Public route (auth: false): the caller's id token is expired by definition,
 * so the Cognito authorizer must not gate this. The refresh token itself is
 * the credential — Cognito validates it (30-day validity, revocable).
 *
 * Note: REFRESH_TOKEN_AUTH does NOT return a new refresh token; the response
 * deliberately omits the field rather than sending `undefined` (the frontend
 * keeps its stored one).
 */
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { apiHandler, parseBody, HttpError, PublicEvent } from '../../../shared/middleware/handler';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import { z } from 'zod';

const cognito = new CognitoIdentityProviderClient({});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const handler = apiHandler<PublicEvent>(async (event) => {
  const body = validate(refreshSchema, parseBody(event));

  try {
    const result = await cognito.send(
      new InitiateAuthCommand({
        ClientId: process.env.USER_POOL_CLIENT_ID!,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: body.refreshToken,
        },
      })
    );

    const auth = result.AuthenticationResult;
    if (!auth?.AccessToken || !auth.IdToken) {
      logger.warn('token_refresh_failed', { reason: 'empty_authentication_result' });
      throw new HttpError(401, 'REFRESH_FAILED', 'Could not refresh the session');
    }

    logger.info('token_refresh_succeeded', {});
    return {
      statusCode: 200,
      body: {
        data: {
          accessToken: auth.AccessToken,
          idToken: auth.IdToken,
          expiresIn: auth.ExpiresIn,
        },
      },
    };
  } catch (err: unknown) {
    if (err instanceof HttpError) throw err;
    if (
      err instanceof Error &&
      (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException')
    ) {
      // Expired, revoked, or malformed refresh token — the session is truly
      // over; the client clears tokens and redirects to sign-in.
      logger.info('token_refresh_failed', { reason: 'invalid_refresh_token' });
      throw new HttpError(401, 'REFRESH_FAILED', 'Session expired — please sign in again');
    }
    throw err;
  }
});
