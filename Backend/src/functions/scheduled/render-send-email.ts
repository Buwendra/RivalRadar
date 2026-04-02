import { sendEmail } from '../../shared/services/ses';
import { logger } from '../../shared/utils/logger';

interface AggregatedChange {
  competitorName: string;
  pageUrl: string;
  summary: string;
  significanceScore: number;
  changeType: string;
  detectedAt: string;
}

interface Event {
  userId: string;
  email: string;
  name: string;
  topChanges: AggregatedChange[];
  strategicSummary: string;
}

const BADGE_COLORS: Record<string, string> = {
  pricing: '#dc2626',
  feature: '#2563eb',
  messaging: '#7c3aed',
  hiring: '#059669',
  content: '#d97706',
};

/**
 * Step Function Lambda: Render weekly digest email and send via SES.
 */
export const handler = async (event: Event): Promise<{ sent: boolean }> => {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const changeRows = event.topChanges
    .slice(0, 5)
    .map((c) => {
      const badgeColor = BADGE_COLORS[c.changeType] ?? '#6b7280';
      const sigColor = c.significanceScore >= 7 ? '#dc2626' : c.significanceScore >= 4 ? '#d97706' : '#059669';
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <span style="background: ${badgeColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; text-transform: uppercase;">${c.changeType}</span>
            <strong style="display: block; margin-top: 4px;">${c.competitorName}</strong>
            <span style="color: #6b7280; font-size: 13px;">${c.pageUrl}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="color: ${sigColor}; font-weight: bold; font-size: 18px;">${c.significanceScore}</span><span style="color: #9ca3af;">/10</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">
            ${c.summary}
          </td>
        </tr>`;
    })
    .join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff;">
      <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">RivalScan</h1>
        <p style="color: #93c5fd; margin: 4px 0 0;">Your Weekly Competitive Brief</p>
      </div>

      <div style="padding: 24px 32px;">
        <p style="color: #6b7280; margin: 0 0 20px;">${dateRange}</p>
        <p>Hi ${event.name},</p>

        <h2 style="font-size: 16px; margin: 24px 0 12px;">Top Changes This Week</h2>
        ${event.topChanges.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280;">COMPETITOR</th>
                <th style="padding: 8px 12px; text-align: center; font-size: 12px; color: #6b7280;">SCORE</th>
                <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280;">SUMMARY</th>
              </tr>
            </thead>
            <tbody>${changeRows}</tbody>
          </table>
        ` : '<p style="color: #6b7280;">No significant changes detected this week.</p>'}

        <h2 style="font-size: 16px; margin: 24px 0 12px;">Strategic Insights</h2>
        <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 0 8px 8px 0;">
          ${event.strategicSummary.split('\n').map((p: string) => `<p style="margin: 8px 0; line-height: 1.6;">${p}</p>`).join('')}
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #2563eb; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            View Full Dashboard
          </a>
        </div>
      </div>

      <div style="background: #f9fafb; padding: 16px 32px; border-radius: 0 0 8px 8px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          RivalScan — AI Competitive Intelligence for SMBs
        </p>
      </div>
    </div>
  `;

  try {
    await sendEmail(event.email, `Your Weekly Competitive Brief — ${dateRange}`, html);
    logger.info('Weekly digest sent', { userId: event.userId, email: event.email });
  } catch (err) {
    logger.error('Failed to send weekly digest — continuing pipeline', { userId: event.userId, error: err });
  }

  return { sent: true };
};
