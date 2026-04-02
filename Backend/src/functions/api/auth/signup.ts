import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { apiHandler, parseBody, HttpError, PublicEvent } from '../../../shared/middleware/handler';
import { validate } from '../../../shared/middleware/validation';
import { putItem } from '../../../shared/db/queries';
import { userPK, userSK, gsi3EmailKeys } from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { z } from 'zod';

const cognito = new CognitoIdentityProviderClient({});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export const handler = apiHandler<PublicEvent>(async (event) => {
  const body = validate(signupSchema, parseBody(event));

  // Create Cognito user
  let cognitoSub: string;
  try {
    const result = await cognito.send(
      new SignUpCommand({
        ClientId: process.env.USER_POOL_CLIENT_ID!,
        Username: body.email,
        Password: body.password,
        UserAttributes: [
          { Name: 'email', Value: body.email },
          { Name: 'name', Value: body.name },
        ],
      })
    );
    cognitoSub = result.UserSub!;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'UsernameExistsException') {
      throw new HttpError(409, 'USER_EXISTS', 'An account with this email already exists');
    }
    throw err;
  }

  // Create user record in DynamoDB
  const userId = generateId();
  const now = new Date().toISOString();

  await putItem({
    PK: userPK(userId),
    SK: userSK(),
    id: userId,
    email: body.email.toLowerCase(),
    name: body.name,
    plan: 'scout',
    cognitoSub,
    onboardingComplete: false,
    createdAt: now,
    updatedAt: now,
    ...gsi3EmailKeys(body.email, userId),
  });

  return {
    statusCode: 201,
    body: {
      data: {
        userId,
        message: 'Account created. Please check your email to verify your account.',
      },
    },
  };
});
