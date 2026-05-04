/**
 * Notifier facade — single entry point for any user-facing alert/digest.
 *
 * Resolves the user's integrations + notification preferences, then dispatches
 * to every channel that is both (a) configured and (b) opted-in for the
 * given event type. Each adapter call is best-effort — one channel's failure
 * does not block another, and non-fatal errors are logged + recorded on the
 * IntegrationCredential row for the next display.
 *
 * Two entry points:
 *   - `dispatchCriticalAlert` — fired inline from `deep-research.ts` when a
 *     delta scores significance >= 8.
 *   - `dispatchWeeklyDigest` — fired from `render-send-email.ts` after the
 *     digest HTML has been rendered.
 *
 * Email recipient comes from the User record. Slack/webhook URLs come from
 * IntegrationCredential rows. Per-event preferences live on the User record
 * under `notificationPreferences` (defaults applied if absent).
 */

import { queryByPK, updateItem } from '../db/queries';
import { integrationPK, integrationSK } from '../db/keys';
import { logger } from '../utils/logger';
import { sendEmailNotification } from './notifiers/email-adapter';
import {
  sendSlackNotification,
  buildCriticalAlertBlocks,
  buildWeeklyDigestBlocks,
} from './notifiers/slack-adapter';
import { sendWebhookNotification } from './notifiers/webhook-adapter';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type IntegrationCredential,
  type IntegrationProvider,
  type NotificationPreferences,
} from '../types/integration';

type EventType = 'weeklyDigest' | 'criticalAlerts';

interface UserContextSlim {
  userId: string;
  email: string;
  name: string;
  notificationPreferences?: NotificationPreferences;
}

async function loadIntegrations(userId: string): Promise<Map<IntegrationProvider, IntegrationCredential>> {
  const out = new Map<IntegrationProvider, IntegrationCredential>();
  try {
    const { items } = await queryByPK(integrationPK(userId), 'INTEGRATION#');
    for (const item of items) {
      const provider = (item.provider as IntegrationProvider | undefined) ?? null;
      if (provider === 'slack' || provider === 'webhook') {
        out.set(provider, item as unknown as IntegrationCredential);
      }
    }
  } catch (err) {
    logger.warn('notifier: failed to load integrations — falling back to email-only', {
      userId,
      error: String(err),
    });
  }
  return out;
}

function isEnabled(
  prefs: NotificationPreferences,
  channel: 'email' | 'slack' | 'webhook',
  event: EventType
): boolean {
  const channelPrefs = prefs[channel] ?? DEFAULT_NOTIFICATION_PREFERENCES[channel] ?? {};
  return channelPrefs[event] === true;
}

async function recordDelivery(
  userId: string,
  provider: IntegrationProvider,
  ok: boolean,
  error?: string
): Promise<void> {
  try {
    await updateItem(integrationPK(userId), integrationSK(provider), {
      lastDeliveryAt: new Date().toISOString(),
      lastDeliveryStatus: ok ? 'ok' : 'failed',
      ...(ok ? { lastDeliveryError: null } : { lastDeliveryError: error?.slice(0, 400) ?? 'unknown' }),
    });
  } catch (err) {
    logger.warn('notifier: failed to record delivery status', {
      userId,
      provider,
      error: String(err),
    });
  }
}

/** Compose effective preferences = user overrides ∘ defaults. */
function effectivePrefs(prefs?: NotificationPreferences): NotificationPreferences {
  return {
    email: { ...DEFAULT_NOTIFICATION_PREFERENCES.email, ...(prefs?.email ?? {}) },
    slack: { ...DEFAULT_NOTIFICATION_PREFERENCES.slack, ...(prefs?.slack ?? {}) },
    webhook: { ...DEFAULT_NOTIFICATION_PREFERENCES.webhook, ...(prefs?.webhook ?? {}) },
  };
}

// ─── dispatchCriticalAlert ───

export interface CriticalAlertInput {
  user: UserContextSlim;
  competitorName: string;
  changeId: string;
  changeTitle: string;
  changeDetail: string;
  significance: number;
  category: string;
  citationUrl?: string;
}

/**
 * Fired inline from deep-research.ts when a delta with significance >= 8 is
 * detected. Sends to email + slack + webhook (per the user's preferences),
 * each best-effort. Returns the per-channel outcome for forensic logging.
 */
export async function dispatchCriticalAlert(
  input: CriticalAlertInput
): Promise<{ email?: boolean; slack?: boolean; webhook?: boolean }> {
  const prefs = effectivePrefs(input.user.notificationPreferences);
  const integrations = await loadIntegrations(input.user.userId);
  const dashboardUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboard`;
  const result: { email?: boolean; slack?: boolean; webhook?: boolean } = {};

  // Email
  if (isEnabled(prefs, 'email', 'criticalAlerts')) {
    const subject = `🚨 ${input.competitorName}: ${input.changeTitle}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Critical Competitor Alert (${input.significance}/10)</h2>
        <p><strong>${input.competitorName}</strong> — ${input.changeTitle}</p>
        <p>${input.changeDetail}</p>
        ${input.citationUrl ? `<p><a href="${input.citationUrl}">Source</a></p>` : ''}
        <p style="margin-top: 20px;">
          <a href="${dashboardUrl}" style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View on RivalScan</a>
        </p>
      </div>
    `;
    const r = await sendEmailNotification({ to: input.user.email, subject, html });
    result.email = r.ok;
  }

  // Slack
  const slack = integrations.get('slack');
  if (slack && isEnabled(prefs, 'slack', 'criticalAlerts')) {
    const { text, blocks } = buildCriticalAlertBlocks({
      competitorName: input.competitorName,
      changeTitle: input.changeTitle,
      changeDetail: input.changeDetail,
      significance: input.significance,
      category: input.category,
      citationUrl: input.citationUrl,
      dashboardUrl,
    });
    const r = await sendSlackNotification(slack.secret, { text, blocks });
    result.slack = r.ok;
    await recordDelivery(input.user.userId, 'slack', r.ok, r.ok ? undefined : r.error);
  }

  // Webhook
  const webhook = integrations.get('webhook');
  if (webhook && webhook.hmacSecret && isEnabled(prefs, 'webhook', 'criticalAlerts')) {
    const r = await sendWebhookNotification({
      url: webhook.secret,
      hmacSecret: webhook.hmacSecret,
      envelope: {
        event: 'change.critical',
        timestamp: new Date().toISOString(),
        data: {
          changeId: input.changeId,
          competitorName: input.competitorName,
          title: input.changeTitle,
          detail: input.changeDetail,
          significance: input.significance,
          category: input.category,
          citationUrl: input.citationUrl,
        },
      },
    });
    result.webhook = r.ok;
    await recordDelivery(input.user.userId, 'webhook', r.ok, r.ok ? undefined : r.error);
  }

  logger.info('notifier.dispatchCriticalAlert completed', {
    userId: input.user.userId,
    changeId: input.changeId,
    significance: input.significance,
    result,
  });

  return result;
}

// ─── dispatchWeeklyDigest ───

export interface WeeklyDigestInput {
  user: UserContextSlim;
  emailSubject: string;
  emailHtml: string;
  changeCount: number;
  topRecommendation?: { title: string; body: string };
  /**
   * Compact JSON payload sent to webhook integrations. The integrations
   * test endpoint also uses this shape so handlers see consistent data.
   */
  webhookData: {
    changeCount: number;
    topRecommendations: Array<{ title: string; body: string; category: string }>;
    weekRange: { start: string; end: string };
  };
}

export async function dispatchWeeklyDigest(
  input: WeeklyDigestInput
): Promise<{ email?: boolean; slack?: boolean; webhook?: boolean }> {
  const prefs = effectivePrefs(input.user.notificationPreferences);
  const integrations = await loadIntegrations(input.user.userId);
  const dashboardUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboard`;
  const result: { email?: boolean; slack?: boolean; webhook?: boolean } = {};

  // Email — only path that's near-mandatory; keeps the existing behavior
  // even when the user has integrations but flips the default off.
  if (isEnabled(prefs, 'email', 'weeklyDigest')) {
    const r = await sendEmailNotification({
      to: input.user.email,
      subject: input.emailSubject,
      html: input.emailHtml,
    });
    result.email = r.ok;
  }

  // Slack
  const slack = integrations.get('slack');
  if (slack && isEnabled(prefs, 'slack', 'weeklyDigest')) {
    const { text, blocks } = buildWeeklyDigestBlocks({
      changeCount: input.changeCount,
      topRecommendation: input.topRecommendation,
      dashboardUrl,
    });
    const r = await sendSlackNotification(slack.secret, { text, blocks });
    result.slack = r.ok;
    await recordDelivery(input.user.userId, 'slack', r.ok, r.ok ? undefined : r.error);
  }

  // Webhook
  const webhook = integrations.get('webhook');
  if (webhook && webhook.hmacSecret && isEnabled(prefs, 'webhook', 'weeklyDigest')) {
    const r = await sendWebhookNotification({
      url: webhook.secret,
      hmacSecret: webhook.hmacSecret,
      envelope: {
        event: 'digest.weekly',
        timestamp: new Date().toISOString(),
        data: input.webhookData,
      },
    });
    result.webhook = r.ok;
    await recordDelivery(input.user.userId, 'webhook', r.ok, r.ok ? undefined : r.error);
  }

  logger.info('notifier.dispatchWeeklyDigest completed', {
    userId: input.user.userId,
    result,
  });

  return result;
}

// ─── Test entry point (used by the integrations test API handler) ───

export async function dispatchTestPing(input: {
  user: UserContextSlim;
  provider: IntegrationProvider;
}): Promise<{ ok: boolean; error?: string }> {
  const integrations = await loadIntegrations(input.user.userId);
  const integration = integrations.get(input.provider);
  if (!integration) return { ok: false, error: 'Integration not configured' };

  if (input.provider === 'slack') {
    const r = await sendSlackNotification(integration.secret, {
      text: '✅ RivalScan test ping — your Slack integration is wired up.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *RivalScan test ping*\nIf you can read this, your incoming webhook is good to go.',
          },
        },
      ],
    });
    await recordDelivery(input.user.userId, 'slack', r.ok, r.ok ? undefined : r.error);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  if (input.provider === 'webhook') {
    if (!integration.hmacSecret) {
      return { ok: false, error: 'Webhook missing HMAC secret — re-create the integration' };
    }
    const r = await sendWebhookNotification({
      url: integration.secret,
      hmacSecret: integration.hmacSecret,
      envelope: {
        event: 'integration.test',
        timestamp: new Date().toISOString(),
        data: { message: 'RivalScan test ping' },
      },
    });
    await recordDelivery(input.user.userId, 'webhook', r.ok, r.ok ? undefined : r.error);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return { ok: false, error: `Unknown provider: ${String(input.provider)}` };
}
