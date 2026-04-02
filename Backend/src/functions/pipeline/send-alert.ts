import { sendEmail } from '../../shared/services/ses';
import { getItem } from '../../shared/db/queries';
import { userPK, userSK } from '../../shared/db/keys';
import { logger } from '../../shared/utils/logger';

interface StoredChange {
  changeId: string;
  significance: number;
  pageUrl: string;
  summary: string;
}

interface Event {
  compId: string;
  userId: string;
  name: string;
  storedChanges: StoredChange[];
}

/**
 * Step Function Lambda: Send email alerts for high-significance changes (score >= 7).
 */
export const handler = async (event: Event): Promise<{ alertsSent: number }> => {
  const highSigChanges = event.storedChanges.filter((c) => c.significance >= 7);

  if (highSigChanges.length === 0) {
    return { alertsSent: 0 };
  }

  // Get user email
  const user = await getItem<Record<string, unknown>>(userPK(event.userId), userSK());
  if (!user?.email) {
    logger.warn('Cannot send alert — user not found', { userId: event.userId });
    return { alertsSent: 0 };
  }

  const changesList = highSigChanges
    .map(
      (c) =>
        `<li><strong>${c.pageUrl}</strong> (Significance: ${c.significance}/10)<br/>${c.summary}</li>`
    )
    .join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">High-Priority Competitor Alert</h2>
      <p>We detected ${highSigChanges.length} significant change(s) from <strong>${event.name}</strong>:</p>
      <ul>${changesList}</ul>
      <p style="margin-top: 20px;">
        <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
          View Details
        </a>
      </p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        — RivalScan Competitive Intelligence
      </p>
    </div>
  `;

  try {
    await sendEmail(
      user.email as string,
      `Alert: ${highSigChanges.length} significant change(s) from ${event.name}`,
      html
    );
    logger.info('Alerts sent', { userId: event.userId, count: highSigChanges.length });
  } catch (err) {
    logger.error('Failed to send alert email — continuing pipeline', { userId: event.userId, error: err });
  }

  return { alertsSent: highSigChanges.length };
};
