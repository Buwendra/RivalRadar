import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { apiHandler, parseBody, HttpError, PublicEvent } from '../../../shared/middleware/handler';
import { validate } from '../../../shared/middleware/validation';
import { z } from 'zod';

const cognito = new CognitoIdentityProviderClient({});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const handler = apiHandler<PublicEvent>(async (event) => {
  const body = validate(signinSchema, parseBody(event));

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
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (err instanceof Error && err.name === 'UserNotConfirmedException') {
      throw new HttpError(403, 'UNCONFIRMED', 'Please verify your email before signing in');
    }
    throw err;
  }
});
