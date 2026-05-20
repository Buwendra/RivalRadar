/**
 * Phase 24 — Comparative Briefing pipeline step 3.
 *
 * Renders the PR-flavoured weekly email and sends it directly via the email
 * adapter. NOT routed through dispatchWeeklyDigest because that fans out to
 * Slack/webhook and is gated by the `weeklyDigest` preference; the comparative
 * brief is email-only and gated by `email.comparativeBrief` (already checked
 * upstream in get-comparative-subscribers).
 */

import { sendEmailNotification } from '../../shared/services/notifiers/email-adapter';
import { logger } from '../../shared/utils/logger';
import type { ComparativeBriefingPayload } from './aggregate-brand-coverage';

interface Event extends ComparativeBriefingPayload {
  briefingText: string;
  suggestedAngles: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  news: 'News',
  product: 'Product',
  funding: 'Funding',
  hiring: 'Hiring',
  social: 'Social',
};

export const handler = async (event: Event): Promise<{ sent: boolean }> => {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = `${weekStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} — ${now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  const sentTotal =
    event.brand.sentiment.positive +
    event.brand.sentiment.neutral +
    event.brand.sentiment.negative;
  const sentSummary =
    sentTotal === 0
      ? 'No sentiment-tagged coverage this week.'
      : `<strong>${event.brand.sentiment.positive}</strong> positive · <strong>${event.brand.sentiment.neutral}</strong> neutral · <strong>${event.brand.sentiment.negative}</strong> negative`;

  // Top-3 SoV categories where you appear (sorted desc by percent).
  const topSovEntries = Object.entries(event.sovByCategory)
    .sort(([, a], [, b]) => b.percent - a.percent)
    .slice(0, 3);

  const sovRows = topSovEntries
    .map(([cat, v]) => {
      const label = CATEGORY_LABELS[cat] ?? cat;
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${label}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
            <strong style="color: #059669;">${v.percent}%</strong>
            <span style="color: #6b7280; font-size: 12px;"> — rank ${v.rank} of ${v.outOf}</span>
          </td>
        </tr>`;
    })
    .join('');

  const briefingHtml = event.briefingText
    .split('\n\n')
    .map((p) => `<p style="margin: 10px 0; line-height: 1.6;">${p}</p>`)
    .join('');

  const anglesHtml =
    event.suggestedAngles.length > 0
      ? `
        <h2 style="font-size: 16px; margin: 24px 0 12px;">Suggested Narrative Angles</h2>
        <ol style="padding-left: 18px; margin: 0;">
          ${event.suggestedAngles
            .map(
              (a) => `<li style="margin-bottom: 8px; line-height: 1.5;">${a}</li>`
            )
            .join('')}
        </ol>`
      : '';

  const competitorBlock =
    event.competitors.length > 0
      ? `
        <h2 style="font-size: 16px; margin: 24px 0 12px;">Competitor Coverage This Week</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280;">COMPETITOR</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #6b7280;">MENTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${event.competitors
              .map(
                (c) => `
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${c.name}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; tabular-nums;">${c.mentions7d}</td>
                  </tr>`
              )
              .join('')}
          </tbody>
        </table>`
      : '';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff;">
      <div style="background: #0f3d2e; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">RivalScan</h1>
        <p style="color: #86efac; margin: 4px 0 0;">Your Comparative Brief</p>
      </div>

      <div style="padding: 24px 32px;">
        <p style="color: #6b7280; margin: 0 0 20px;">${dateRange}</p>
        <p>Hi ${event.name},</p>

        <h2 style="font-size: 16px; margin: 24px 0 12px;">${event.brand.name} this week</h2>
        <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 8px;"><strong>${event.brand.mentions7d}</strong> tracked mention${event.brand.mentions7d === 1 ? '' : 's'}</p>
          <p style="margin: 0; font-size: 13px; color: #4b5563;">${sentSummary}</p>
        </div>

        ${
          sovRows
            ? `
          <h2 style="font-size: 16px; margin: 24px 0 12px;">Where you broke through</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>${sovRows}</tbody>
          </table>`
            : ''
        }

        <h2 style="font-size: 16px; margin: 24px 0 12px;">Comparative briefing</h2>
        <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 0 8px 8px 0;">
          ${briefingHtml}
        </div>

        ${anglesHtml}

        ${competitorBlock}

        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/your-brand" style="background: #059669; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            Open Brand Pulse
          </a>
        </div>
      </div>

      <div style="background: #f9fafb; padding: 16px 32px; border-radius: 0 0 8px 8px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px;">
          RivalScan — AI Market Intelligence for SMBs
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

  const result = await sendEmailNotification({
    to: event.email,
    subject: `Your Comparative Brief — ${dateRange}`,
    html,
  });

  logger.info('Comparative brief dispatched', {
    userId: event.userId,
    sent: result.ok,
    mentions: event.brand.mentions7d,
    anglesCount: event.suggestedAngles.length,
  });

  return { sent: result.ok };
};
