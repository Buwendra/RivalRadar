import { logger } from '../../utils/logger';

/**
 * Slack Block Kit primitive — narrow type so callers building blocks
 * locally don't need to import the entire @slack/types package.
 */
export interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

export interface SlackPayload {
  /** Plain-text fallback for notification previews + accessibility tooling. */
  text: string;
  blocks?: SlackBlock[];
}

/**
 * Slack adapter — POSTs to a user-pasted incoming-webhook URL.
 *
 * Why incoming-webhook (not full OAuth + chat.postMessage): incoming webhooks
 * don't require us to register a Slack app, store OAuth tokens, refresh
 * scopes, or route the user through an install flow. The user creates an
 * incoming webhook in their workspace's Slack admin once, pastes the URL into
 * RivalScan, and we POST to it. Trade-off: we can't post to arbitrary
 * channels — the webhook is bound to one channel the user picked at create
 * time. That's the right shape for "send my weekly digest to #competitive".
 *
 * NEVER logs the URL (it's a credential).
 */
export async function sendSlackNotification(
  webhookUrl: string,
  payload: SlackPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      const error = `slack ${resp.status}: ${body.slice(0, 200)}`;
      logger.warn('slack-adapter: non-2xx response', {
        status: resp.status,
        bodySnippet: body.slice(0, 200),
      });
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn('slack-adapter: fetch failed', { error });
    return { ok: false, error };
  }
}

/**
 * Build a critical-alert Block Kit message for a single change. Used inline
 * by `deep-research.ts` and by the integrations test endpoint.
 */
export function buildCriticalAlertBlocks(input: {
  competitorName: string;
  changeTitle: string;
  changeDetail: string;
  significance: number;
  category: string;
  citationUrl?: string;
  dashboardUrl: string;
}): { text: string; blocks: SlackBlock[] } {
  const text = `🚨 ${input.competitorName}: ${input.changeTitle} (${input.significance}/10)`;
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🚨 Critical: ${input.competitorName}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${input.changeTitle}*\n${input.changeDetail}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Significance* ${input.significance}/10  ·  *Category* ${input.category}${
            input.citationUrl ? `  ·  <${input.citationUrl}|Source>` : ''
          }`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View on RivalScan', emoji: true },
          url: input.dashboardUrl,
        },
      ],
    },
  ];
  return { text, blocks };
}

/**
 * Compact weekly-digest Slack message — links back to the dashboard
 * rather than rendering the full digest in Slack (Block Kit length limits
 * + readability favor a teaser + click-through).
 */
export function buildWeeklyDigestBlocks(input: {
  changeCount: number;
  topRecommendation?: { title: string; body: string };
  dashboardUrl: string;
}): { text: string; blocks: SlackBlock[] } {
  const text = `Weekly Competitive Brief — ${input.changeCount} change${input.changeCount === 1 ? '' : 's'} detected`;
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📊 Weekly Competitive Brief', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${input.changeCount} change${input.changeCount === 1 ? '' : 's'} detected this week.`,
      },
    },
  ];
  if (input.topRecommendation) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Top recommendation:* ${input.topRecommendation.title}\n${input.topRecommendation.body}`,
      },
    });
  }
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Read full briefing', emoji: true },
        url: input.dashboardUrl,
        style: 'primary',
      },
    ],
  });
  return { text, blocks };
}
