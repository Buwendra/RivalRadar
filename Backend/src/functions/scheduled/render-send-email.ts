import { dispatchWeeklyDigest } from '../../shared/services/notifier';
import { generateAudioBriefing } from '../../shared/services/elevenlabs';
import { storeAudioBriefing } from '../../shared/services/audio-briefing-storage';
import { getItem } from '../../shared/db/queries';
import { userPK, userSK } from '../../shared/db/keys';
import { hasCapability } from '../../shared/utils/capability';
import { logger } from '../../shared/utils/logger';
import type { Recommendation, User } from '../../shared/types';

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
  topRecommendations?: Recommendation[];
}

const BADGE_COLORS: Record<string, string> = {
  pricing: '#dc2626',
  feature: '#2563eb',
  messaging: '#7c3aed',
  hiring: '#059669',
  content: '#d97706',
};

const RECOMMENDATION_CATEGORY_LABELS: Record<string, string> = {
  positioning: 'Positioning',
  pricing: 'Pricing',
  messaging: 'Messaging',
  product: 'Product',
  sales: 'Sales',
  talent: 'Talent',
};

const TIME_HORIZON_LABELS: Record<string, string> = {
  'this-week': 'This week',
  'this-month': 'This month',
  'this-quarter': 'This quarter',
};

/**
 * Step Function Lambda: Render weekly digest email and send via SES.
 */
export const handler = async (event: Event): Promise<{ sent: boolean }> => {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Phase 2 demo-wow: TTS-narrate the strategic summary via ElevenLabs and
  // embed a "Listen" CTA in the email + persist a row the dashboard reads.
  // Strategist+ only. Failures (missing API key, ElevenLabs 5xx, etc.) silently
  // skip — the digest still ships as text-only.
  const userRecord = await getItem<User & Record<string, unknown>>(
    userPK(event.userId),
    userSK()
  );
  let audioCta = '';
  let audioDurationSec: number | undefined;
  if (userRecord && hasCapability(userRecord, 'audioBriefing') && event.strategicSummary) {
    const tts = await generateAudioBriefing(event.strategicSummary);
    if (tts) {
      try {
        const stored = await storeAudioBriefing({
          tenantUserId: event.userId,
          mp3: tts.mp3,
          charCount: tts.charCount,
          durationSec: tts.durationSec,
        });
        audioDurationSec = stored.durationSec;
        const mm = Math.floor(stored.durationSec / 60);
        const ss = String(stored.durationSec % 60).padStart(2, '0');
        audioCta = `
          <div style="background: #1e3a5f; border-radius: 8px; padding: 16px 20px; margin: 16px 0; text-align: center;">
            <p style="color: #93c5fd; margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Listen to your briefing</p>
            <a href="${stored.presignedUrl}" style="color: white; text-decoration: none; font-size: 16px; font-weight: 500; display: inline-block;">
              ▶ Play (${mm}:${ss})
            </a>
            <p style="color: #93c5fd; margin: 8px 0 0; font-size: 11px;">Tap to listen — link expires in 7 days.</p>
          </div>`;
      } catch (err) {
        logger.warn('audio_briefing_storage_failed', {
          userId: event.userId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  void audioDurationSec; // recorded on the DDB row; surfaced via /users/me

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

        ${audioCta}

        ${
          (event.topRecommendations ?? []).length > 0
            ? `
          <h2 style="font-size: 16px; margin: 24px 0 12px;">Recommended Actions</h2>
          <div style="space-y: 12px;">
            ${(event.topRecommendations ?? [])
              .map((r, i) => {
                const horizonLabel = TIME_HORIZON_LABELS[r.timeHorizon] ?? r.timeHorizon;
                const categoryLabel = RECOMMENDATION_CATEGORY_LABELS[r.category] ?? r.category;
                const confPct = Math.round(r.confidence * 100);
                return `
                  <div style="background: #fff7ed; border-left: 4px solid #d97706; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 12px;">
                    <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;">
                      <span style="color: #d97706; font-weight: 600; font-size: 13px;">${i + 1}.</span>
                      <strong style="font-size: 14px;">${r.title}</strong>
                    </div>
                    <p style="margin: 4px 0 8px 18px; line-height: 1.5; font-size: 13px; color: #374151;">${r.body}</p>
                    <div style="margin-left: 18px; font-size: 11px; color: #6b7280;">
                      <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 10px;">${categoryLabel}</span>
                      &nbsp;·&nbsp; ${horizonLabel}
                      &nbsp;·&nbsp; ${r.effortLevel} effort
                      &nbsp;·&nbsp; ${confPct}% confidence
                    </div>
                  </div>`;
              })
              .join('')}
          </div>
        `
            : ''
        }

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
        <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px;">
          RivalScan — AI Competitive Intelligence for SMBs
        </p>
        <p style="color: #9ca3af; font-size: 11px; margin: 0; line-height: 1.5;">
          AI-generated analysis. May contain errors. For internal evaluation only — not legal, financial, or investment advice.<br>
          <a href="${process.env.FRONTEND_URL}/legal/aup" style="color: #6b7280;">Acceptable Use Policy</a>
          &nbsp;·&nbsp;
          <a href="${process.env.FRONTEND_URL}/legal/privacy" style="color: #6b7280;">Privacy Policy</a>
          &nbsp;·&nbsp;
          <a href="${process.env.FRONTEND_URL}/dashboard/settings" style="color: #6b7280;">Manage Email Preferences</a>
        </p>
      </div>
    </div>
  `;

  // Dispatch via the notifier facade — fans out to email + any configured
  // Slack / webhook integrations the user has opted in for `weeklyDigest`.
  // Each channel is best-effort; one failure doesn't block another.
  try {
    const top = (event.topRecommendations ?? [])[0];
    const dispatchResult = await dispatchWeeklyDigest({
      user: {
        userId: event.userId,
        email: event.email,
        name: event.name,
        notificationPreferences: userRecord?.notificationPreferences,
      },
      emailSubject: `Your Weekly Competitive Brief — ${dateRange}`,
      emailHtml: html,
      changeCount: event.topChanges.length,
      ...(top ? { topRecommendation: { title: top.title, body: top.body } } : {}),
      webhookData: {
        changeCount: event.topChanges.length,
        topRecommendations: (event.topRecommendations ?? [])
          .slice(0, 3)
          .map((r) => ({ title: r.title, body: r.body, category: r.category })),
        weekRange: { start: weekStart.toISOString(), end: now.toISOString() },
      },
    });
    logger.info('Weekly digest dispatched', { userId: event.userId, dispatchResult });
  } catch (err) {
    logger.error('Failed to dispatch weekly digest — continuing pipeline', {
      userId: event.userId,
      error: err,
    });
  }

  return { sent: true };
};
