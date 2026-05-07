/**
 * In-app notification writer (Phase 18).
 *
 * Fire-and-forget: a write failure must not roll back the user's action.
 * Callers should `void enqueueNotification(...)` (or `await` and discard)
 * at the end of a successful mutation handler. Mirrors `recordAuditEvent`
 * (Phase 4b) — distinct concern, distinct entity.
 */

import { generateId } from '../utils/id';
import { putItem } from '../db/queries';
import { notificationPK, notificationSK } from '../db/keys';
import { logger } from '../utils/logger';
import type { Notification, NotificationKind } from '../types';

const TTL_DAYS = 90;

export interface EnqueueNotificationInput {
  recipientUserId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  meta?: Record<string, string | number | boolean>;
}

export async function enqueueNotification(
  input: EnqueueNotificationInput
): Promise<void> {
  if (!input.recipientUserId) {
    logger.warn('notification_skipped_no_recipient', { kind: input.kind });
    return;
  }
  const id = generateId();
  const now = new Date();
  const row: Notification = {
    id,
    recipientUserId: input.recipientUserId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    ...(input.href !== undefined ? { href: input.href } : {}),
    ...(input.meta !== undefined ? { meta: input.meta } : {}),
    createdAt: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + TTL_DAYS * 24 * 60 * 60,
  };
  try {
    await putItem({
      PK: notificationPK(input.recipientUserId),
      SK: notificationSK(row.createdAt, id),
      ...row,
    });
  } catch (err) {
    logger.warn('notification_write_failed', {
      kind: input.kind,
      recipientUserId: input.recipientUserId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
