/**
 * /changes/{id}/notes — list (GET) + create (POST) analyst annotations
 * (Phase 7a).
 *
 * The route file dispatches on event.requestContext.http.method to share
 * the change-resolution logic between read + write. Notes are stored under
 * the competitor's PK (COMP#<compId>) so they share locality with the
 * change record itself.
 *
 * Auth: each request resolves the calling user → userId, then re-resolves
 * the target change to confirm `change.userId === userId` before serving
 * notes. The change-resolution scan via GSI1 is bounded at 100 items
 * (matches the existing /changes/{id} GET handler pattern); for older
 * changes this would 404 — a known limitation, fix when full-text search
 * lands in Phase 7b.
 */

import { z } from 'zod';
import {
  apiHandler,
  getUserEmail,
  HttpError,
  parseBody,
} from '../../../shared/middleware/handler';
import {
  queryGSI,
  queryByPK,
  putItem,
  getItem,
} from '../../../shared/db/queries';
import {
  changeNotePK,
  changeNoteSK,
  changeNoteSKPrefix,
  userPK,
  userSK,
} from '../../../shared/db/keys';
import { generateId } from '../../../shared/utils/id';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import type { ChangeNote, User } from '../../../shared/types';

const createSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const changeId = event.pathParameters?.id;
  if (!changeId) throw new HttpError(400, 'MISSING_ID', 'Change id is required');

  const { items: emailItems } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  if (emailItems.length === 0) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const userId = (emailItems[0].GSI3SK as string).replace('USER#', '');

  // Resolve the change to (a) confirm ownership and (b) get competitorId
  // for the notes PK. Same scan pattern as /changes/{id} GET.
  const { items: changeItems } = await queryGSI('GSI1', 'GSI1PK', userId, 'CHANGE#', {
    skName: 'GSI1SK',
    limit: 100,
  });
  const change = changeItems.find((c) => c.id === changeId);
  if (!change) throw new HttpError(404, 'NOT_FOUND', 'Change not found');
  const competitorId = change.competitorId as string;

  const method = event.requestContext.http.method;

  if (method === 'GET') {
    const { items } = await queryByPK(
      changeNotePK(competitorId),
      changeNoteSKPrefix(changeId),
      { scanForward: true, limit: 100 }
    );
    const notes = items as unknown as ChangeNote[];
    return {
      statusCode: 200,
      body: { data: notes },
    };
  }

  // POST — create a note
  const payload = validate(createSchema, parseBody(event));

  // Load the user so we can denormalize the author name onto the note.
  // Saves a follow-up GET on every notes-list render.
  const user = await getItem<User & Record<string, unknown>>(userPK(userId), userSK());
  const authorName = user?.name ?? 'Unknown';

  const id = generateId();
  const now = new Date().toISOString();
  const note: ChangeNote = {
    id,
    changeId,
    competitorId,
    authorUserId: userId,
    authorName,
    body: payload.body,
    createdAt: now,
  };

  await putItem({
    PK: changeNotePK(competitorId),
    SK: changeNoteSK(changeId, now),
    ...note,
  });

  logger.info('change_note_created', {
    userId,
    changeId,
    competitorId,
    noteId: id,
    bodyLen: payload.body.length,
  });

  return {
    statusCode: 201,
    body: { data: note },
  };
});
