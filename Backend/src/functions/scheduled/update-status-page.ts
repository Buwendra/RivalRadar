/**
 * Phase 8c — public status page updater.
 *
 * Triggered by:
 *   1. SNS subscription on the alerts topic (every alarm state change).
 *   2. Daily cron at midnight UTC (keeps the "as of" timestamp fresh).
 *
 * Both triggers ignore the input event and re-derive page contents from
 * scratch by reading current alarm state via DescribeAlarms. This way a
 * flapping alarm or a missed SNS event can't cause the page to drift away
 * from reality — every render is a snapshot of the truth at that moment.
 *
 * The page is plain HTML — no React, no JS. Loads in <100ms over CloudFront,
 * and degrades to readable plain text if CSS fails. Standard "all systems
 * operational" / "degraded" / "outage" semantics.
 */

import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  type MetricAlarm,
} from '@aws-sdk/client-cloudwatch';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import { logger } from '../../shared/utils/logger';

const cw = new CloudWatchClient({});
const s3 = new S3Client({});
const cf = new CloudFrontClient({});

interface ComponentState {
  /** User-facing component name extracted from the alarm name. */
  name: string;
  status: 'operational' | 'degraded' | 'outage' | 'unknown';
  alarmName: string;
  reason?: string;
  stateUpdatedAt?: string;
}

/**
 * Map an alarm name to a user-facing component name. Alarms in the
 * MonitoringStack follow the convention `<stackName>-<ResourceName>Errors`
 * or similar — strip the prefix + suffix to get something readable.
 */
function componentNameFromAlarm(alarmName: string, prefix: string): string {
  let n = alarmName;
  if (n.startsWith(prefix)) n = n.slice(prefix.length);
  // Strip leading hyphen / common suffixes
  n = n.replace(/^-/, '');
  n = n.replace(/Errors$/i, '');
  n = n.replace(/Alarm$/i, '');
  n = n.replace(/Rate$/i, '');
  // Insert spaces before capital letters in CamelCase
  n = n.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Friendlier mappings for known names
  const friendly: Record<string, string> = {
    'Api5xxErrors': 'API errors',
    'ApiHighLatency': 'API latency',
    'DdbThrottled': 'Database throttling',
    'SesBounceRate': 'Email delivery',
    'DeepResearchErrorRate': 'Deep research',
    'AggregateChanges': 'Weekly digest aggregator',
    'GenerateSummary': 'Weekly digest summary',
    'GenerateRecommendations': 'Recommendations generator',
    'RenderSendEmail': 'Weekly digest email',
    'EnqueueRecurring': 'Recurring research scheduler',
    'AggregateAiCosts': 'Cost aggregator',
    'SendScheduledReports': 'Monthly briefings',
    'SendRetentionNudges': 'Retention nudges',
    'RefreshOfacSdn': 'OFAC drift detection',
  };
  return friendly[n] ?? n;
}

function alarmStateToStatus(alarm: MetricAlarm): ComponentState['status'] {
  if (!alarm.StateValue) return 'unknown';
  switch (alarm.StateValue) {
    case 'OK':
      return 'operational';
    case 'INSUFFICIENT_DATA':
      // Common at fresh deploy when alarms haven't seen any data yet —
      // safer to render as 'unknown' than to false-positive 'outage'.
      return 'unknown';
    case 'ALARM':
      // We don't currently distinguish degraded vs outage; treat any active
      // alarm as 'outage' for the headline status. Per-component detail
      // shows the alarm reason for nuance.
      return 'outage';
    default:
      return 'unknown';
  }
}

const STATUS_RANK: Record<ComponentState['status'], number> = {
  outage: 0,
  degraded: 1,
  unknown: 2,
  operational: 3,
};

const STATUS_COLOR: Record<ComponentState['status'], string> = {
  operational: '#10b981',
  degraded: '#f59e0b',
  outage: '#dc2626',
  unknown: '#6b7280',
};

const STATUS_LABEL: Record<ComponentState['status'], string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  outage: 'Outage',
  unknown: 'Unknown',
};

function renderHtml(components: ComponentState[], asOf: string): string {
  // Headline = worst across all components
  const worst = components.reduce<ComponentState['status']>(
    (acc, c) => (STATUS_RANK[c.status] < STATUS_RANK[acc] ? c.status : acc),
    'operational'
  );
  const headline =
    worst === 'operational'
      ? 'All systems operational'
      : worst === 'outage'
      ? 'We are currently experiencing an outage'
      : worst === 'degraded'
      ? 'Some systems are degraded'
      : 'Status uncertain';

  const headlineColor = STATUS_COLOR[worst];

  const componentsHtml = components
    .slice()
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    .map(
      (c) => `
        <li style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #e5e7eb;">
          <div>
            <div style="font-weight: 500; font-size: 14px;">${escapeHtml(c.name)}</div>
            ${c.reason ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${escapeHtml(c.reason)}</div>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${STATUS_COLOR[c.status]};"></span>
            <span style="font-size: 13px; color: ${STATUS_COLOR[c.status]}; font-weight: 500;">${STATUS_LABEL[c.status]}</span>
          </div>
        </li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Kironyx Status</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #0f172a; margin: 0; padding: 32px 16px; }
    .wrap { max-width: 720px; margin: 0 auto; }
    .header { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 28px; margin-bottom: 16px; text-align: center; }
    .headline { font-size: 22px; font-weight: 600; color: ${headlineColor}; margin: 12px 0 6px; }
    .as-of { font-size: 13px; color: #6b7280; }
    .components { background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .components h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; padding: 14px 18px; margin: 0; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
    ul { list-style: none; padding: 0; margin: 0; }
    .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 24px; }
    .footer a { color: #6b7280; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div style="font-size: 14px; color: #6b7280; font-weight: 500;">Kironyx</div>
      <div class="headline">${escapeHtml(headline)}</div>
      <div class="as-of">Updated ${escapeHtml(asOf)} UTC</div>
    </div>
    <div class="components">
      <h2>Components</h2>
      <ul>${componentsHtml || '<li style="padding: 14px 18px; color: #6b7280;">No alarms configured.</li>'}</ul>
    </div>
    <div class="footer">
      <a href="https://kironyx.com">kironyx.com</a>
      &nbsp;·&nbsp;
      Reflects current state of CloudWatch alarms. Auto-refreshes on alarm state change + daily.
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function listAllAlarms(prefix: string): Promise<MetricAlarm[]> {
  const alarms: MetricAlarm[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await cw.send(
      new DescribeAlarmsCommand({
        AlarmNamePrefix: prefix,
        AlarmTypes: ['MetricAlarm'],
        NextToken: nextToken,
      })
    );
    for (const a of resp.MetricAlarms ?? []) {
      alarms.push(a);
    }
    nextToken = resp.NextToken;
  } while (nextToken);
  return alarms;
}

export const handler = async (): Promise<{ rendered: number; sizeBytes: number }> => {
  const bucket = process.env.STATUS_BUCKET;
  const distributionId = process.env.DISTRIBUTION_ID;
  const alarmNamePrefix = process.env.ALARM_NAME_PREFIX;
  if (!bucket || !distributionId || !alarmNamePrefix) {
    throw new Error(
      'STATUS_BUCKET, DISTRIBUTION_ID, ALARM_NAME_PREFIX env vars are all required'
    );
  }

  const alarms = await listAllAlarms(alarmNamePrefix);
  const components: ComponentState[] = alarms.map((a) => ({
    name: componentNameFromAlarm(a.AlarmName ?? '', alarmNamePrefix),
    status: alarmStateToStatus(a),
    alarmName: a.AlarmName ?? '',
    reason: a.StateValue === 'ALARM' ? a.StateReason : undefined,
    stateUpdatedAt: a.StateUpdatedTimestamp?.toISOString(),
  }));

  // Build the page
  const asOf = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const html = renderHtml(components, asOf);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: 'index.html',
      Body: html,
      ContentType: 'text/html; charset=utf-8',
      CacheControl: 'public, max-age=60', // CloudFront layer caches; this hints to browsers to revisit
    })
  );

  // Invalidate CloudFront so users see fresh content within ~30s. We use a
  // simple wildcard invalidation; AWS bills the first 1000/month free.
  await cf
    .send(
      new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: `${Date.now()}`,
          Paths: { Quantity: 1, Items: ['/*'] },
        },
      })
    )
    .catch((err) => {
      // Don't unwind the page write if the invalidation fails — TTL will
      // naturally refresh within an hour anyway.
      logger.warn('status_page_invalidation_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

  const result = {
    rendered: components.length,
    sizeBytes: Buffer.byteLength(html, 'utf8'),
  };
  logger.info('status_page_updated', {
    ...result,
    components: components.map((c) => ({ name: c.name, status: c.status })),
  });
  return result;
};
