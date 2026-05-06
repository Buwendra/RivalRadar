/**
 * POST /users/me/accept-tos
 *
 * Phase 9a — re-consent endpoint. When TOS_VERSION or PRIVACY_VERSION is
 * bumped in `shared/types/index.ts`, existing users' stored versions go
 * stale and the frontend banner asks them to re-accept. This handler
 * stamps the user's tosVersion/tosAcceptedAt + privacyVersion/privacyAcceptedAt
 * to the current version, so the banner stops showing.
 *
 * Body must echo the current versions back so a stale frontend can't
 * silently re-accept old policy text — it's a fail-closed handshake.
 */

import { z } from 'zod';
import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { queryGSI, updateItem } from '../../../shared/db/queries';
import { userPK, userSK } from '../../../shared/db/keys';
import { validate } from '../../../shared/middleware/validation';
import { TOS_VERSION, PRIVACY_VERSION } from '../../../shared/types';
import { logger } from '../../../shared/utils/logger';

const acceptSchema = z.object({
  tosVersion: z.string().min(1).max(40),
  privacyVersion: z.string().min(1).max(40),
});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(acceptSchema, parseBody(event));

  // Fail-closed handshake — frontend must echo the CURRENT versions. If a
  // stale tab tries to silently re-accept old policy text, we 400 it.
  if (body.tosVersion !== TOS_VERSION || body.privacyVersion !== PRIVACY_VERSION) {
    throw new HttpError(
      400,
      'STALE_VERSIONS',
      'Submitted policy versions do not match the current published versions. Please reload the page.'
    );
  }

  const { items } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (items.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (items[0].GSI3SK as string).replace('USER#', '');

  const now = new Date().toISOString();
  await updateItem(userPK(userId), userSK(), {
    tosVersion: TOS_VERSION,
    tosAcceptedAt: now,
    privacyVersion: PRIVACY_VERSION,
    privacyAcceptedAt: now,
    updatedAt: now,
  });

  logger.info('reconsent_accepted', {
    userId,
    tosVersion: TOS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  });

  return {
    statusCode: 200,
    body: {
      data: {
        tosVersion: TOS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        acceptedAt: now,
      },
    },
  };
});
