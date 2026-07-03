import { dispatchCriticalAlert } from '../../shared/services/notifier';
import { getItem } from '../../shared/db/queries';
import { userPK, userSK } from '../../shared/db/keys';
import { logger } from '../../shared/utils/logger';
import type { User } from '../../shared/types';

interface StoredChange {
  changeId: string;
  significance: number;
  pageUrl: string;
  summary: string;
  detail?: string;
  category?: string;
}

interface Event {
  compId: string;
  userId: string;
  name: string;
  storedChanges: StoredChange[];
}

/**
 * Step Function Lambda — Sends a follow-up alert for high-significance
 * changes (score >= 7) detected during a research run.
 *
 * Note: deep-research.ts ALSO fires `dispatchCriticalAlert` inline for
 * deltas with significance >= 8 (the "real-time critical" threshold per
 * the Phase 3 plan). This Lambda handles the slightly-lower bar (>= 7)
 * via the same notifier facade — same fan-out to email + Slack + webhook
 * per the user's preferences, just without the "🚨 Critical" framing.
 *
 * The two thresholds are intentional:
 *   - sig 8+ = real-time interrupt (Slack ping immediately)
 *   - sig 7  = next-pipeline-step alert (email summary, less urgent)
 */
export const handler = async (event: Event): Promise<{ alertsSent: number }> => {
  // Skip changes already handled by the inline >= 8 critical-alert path so
  // we don't double-notify on the same delta.
  const highSigChanges = event.storedChanges.filter(
    (c) => c.significance >= 7 && c.significance < 8
  );
  if (highSigChanges.length === 0) {
    return { alertsSent: 0 };
  }

  const user = await getItem<User & Record<string, unknown>>(userPK(event.userId), userSK());
  if (!user?.email) {
    logger.warn('Cannot send alert — user not found', { userId: event.userId });
    return { alertsSent: 0 };
  }

  // Send one dispatch per change so each gets its own Slack/webhook entry.
  // Email is the only channel that batches — the notifier already de-dupes
  // by event so the user gets one Slack ping per change rather than one
  // bundled mention.
  let alertsSent = 0;
  for (const change of highSigChanges) {
    try {
      await dispatchCriticalAlert({
        user: {
          userId: event.userId,
          email: user.email,
          name: user.name ?? '',
          notificationPreferences: user.notificationPreferences,
        },
        competitorName: event.name,
        changeId: change.changeId,
        changeTitle: change.summary,
        // Real delta explanation + source category (optional for in-flight
        // events from before these fields existed on StoredChange).
        changeDetail: change.detail ?? change.summary,
        significance: change.significance,
        category: change.category ?? 'news',
      });
      alertsSent += 1;
    } catch (err) {
      logger.error('Failed to dispatch high-sig alert — continuing pipeline', {
        userId: event.userId,
        changeId: change.changeId,
        error: err,
      });
    }
  }

  logger.info('High-sig alerts dispatched', { userId: event.userId, count: alertsSent });
  return { alertsSent };
};
