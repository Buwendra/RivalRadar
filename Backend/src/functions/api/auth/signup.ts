import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { apiHandler, parseBody, HttpError, PublicEvent, getSourceIp, getUserAgent } from '../../../shared/middleware/handler';
import { validate } from '../../../shared/middleware/validation';
import { putItem } from '../../../shared/db/queries';
import { userPK, userSK, gsi3EmailKeys } from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { logger } from '../../../shared/utils/logger';
import { recordAuthAuditEvent } from '../../../shared/services/audit';
import { TOS_VERSION, PRIVACY_VERSION } from '../../../shared/types';
import { z } from 'zod';

const cognito = new CognitoIdentityProviderClient({});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  tosVersion: z.string().optional(),
  privacyVersion: z.string().optional(),
});

export const handler = apiHandler<PublicEvent>(async (event) => {
  const body = validate(signupSchema, parseBody(event));
  const sourceIp = getSourceIp(event);
  const userAgent = getUserAgent(event);

  logger.info('signup_started', { email: body.email });
  void recordAuthAuditEvent({
    action: 'auth.signup_started',
    email: body.email,
    sourceIp,
    userAgent,
  });

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
  const tosVersion = body.tosVersion ?? TOS_VERSION;
  const privacyVersion = body.privacyVersion ?? PRIVACY_VERSION;

  await putItem({
    PK: userPK(userId),
    SK: userSK(),
    id: userId,
    email: body.email.toLowerCase(),
    name: body.name,
    plan: 'scout',
    cognitoSub,
    onboardingComplete: false,
    tosVersion,
    tosAcceptedAt: now,
    privacyVersion,
    privacyAcceptedAt: now,
    createdAt: now,
    updatedAt: now,
    ...gsi3EmailKeys(body.email, userId),
  });

  logger.info('signup_completed', { userId, email: body.email });
  void recordAuthAuditEvent({
    action: 'auth.signup_completed',
    email: body.email,
    userId,
    sourceIp,
    userAgent,
    meta: { tosVersion, privacyVersion },
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
