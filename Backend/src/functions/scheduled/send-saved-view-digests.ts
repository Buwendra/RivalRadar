/**
 * Phase 15 — weekly saved-view email digest cron.
 *
 * EventBridge fires Mon 9am UTC (1 hour after the regular weekly digest).
 * Walks SavedViewSubscription rows via DynamoDB Scan (acceptable at v1
 * volume; migrate to a GSI when count > ~5000), groups by (workspaceId,
 * viewId) so each view is rendered once, then fans out emails to each
 * subscriber.
 *
 * Snoozed competitors are filtered out — same `isSnoozed()` helper as
 * `aggregate-changes.ts`. Empty digests are skipped (no spam).
 *
 * Orphaned subscriptions (view deleted): logged + skipped.
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from '../../shared/db/client';
import {
  getItem,
  queryByPK,
  queryGSI,
  skPrefixRange,
  updateItem,
} from '../../shared/db/queries';
import {
  competitorPK,
  savedViewPK,
  savedViewSK,
  savedViewSubscriptionPK,
  savedViewSubscriptionSK,
  workspacePK,
  workspaceSK,
} from '../../shared/db/keys';
import { isSnoozed } from '../../shared/utils/snooze';
import { applyViewFilters } from '../../shared/utils/view-filters';
import { sendEmail } from '../../shared/services/ses';
import { logger } from '../../shared/utils/logger';
import type {
  SavedView,
  SavedViewSubscription,
  Workspace,
} from '../../shared/types';

const SCAN_PAGE_LIMIT = 200;
const MAX_SUBSCRIPTIONS_PER_RUN = 1000;

const BADGE_COLORS: Record<string, string> = {
  pricing: '#dc2626',
  feature: '#2563eb',
  messaging: '#7c3aed',
  hiring: '#059669',
  content: '#d97706',
};

interface ChangeRow {
  id: string;
  competitorId: string;
  competitorName: string;
  pageUrl: string;
  significance: number;
  detectedAt: string;
  changeType?: string;
  summary?: string;
}

interface ViewGroup {
  workspaceId: string;
  viewId: string;
  subscriptions: SavedViewSubscription[];
}

async function scanSubscriptions(): Promise<SavedViewSubscription[]> {
  const collected: SavedViewSubscription[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':prefix': 'VIEW_SUB#' },
        Limit: SCAN_PAGE_LIMIT,
        ExclusiveStartKey: lastKey,
      })
    );
    for (const item of result.Items ?? []) {
      collected.push(item as unknown as SavedViewSubscription);
      if (collected.length >= MAX_SUBSCRIPTIONS_PER_RUN) {
        return collected;
      }
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return collected;
}

function groupByView(subs: SavedViewSubscription[]): ViewGroup[] {
  const map = new Map<string, ViewGroup>();
  for (const sub of subs) {
    const key = `${sub.workspaceId}::${sub.viewId}`;
    let group = map.get(key);
    if (!group) {
      group = { workspaceId: sub.workspaceId, viewId: sub.viewId, subscriptions: [] };
      map.set(key, group);
    }
    group.subscriptions.push(sub);
  }
  return [...map.values()];
}

function renderDigestHtml(
  viewName: string,
  changes: ChangeRow[]
): string {
  const rows = changes
    .slice(0, 25)
    .map((c) => {
      const color = BADGE_COLORS[c.changeType ?? 'content'] ?? '#6b7280';
      const date = new Date(c.detectedAt).toLocaleDateString();
      return `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
            <div style="font-weight: 600; font-size: 13px;">${escapeHtml(c.competitorName)}</div>
            <div style="font-size: 11px; color: #6b7280;">${date}</div>
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${color}; color: white; font-size: 11px; text-transform: uppercase;">
              ${escapeHtml(c.changeType ?? 'content')}
            </span>
            <span style="margin-left: 8px; font-size: 11px; color: #6b7280;">significance ${c.significance}</span>
            <div style="margin-top: 6px; font-size: 13px;">${escapeHtml(c.summary ?? '')}</div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto;">
      <div style="padding: 24px 28px;">
        <h2 style="margin: 0 0 4px 0; font-size: 18px;">${escapeHtml(viewName)}</h2>
        <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 13px;">
          ${changes.length} change${changes.length === 1 ? '' : 's'} matching this view in the past 7 days.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
          ${rows}
        </table>
        <p style="margin-top: 24px; color: #6b7280; font-size: 11px;">
          You're receiving this email because you subscribed to a saved view in RivalScan.
          Manage your subscriptions: hover the view in your sidebar and click the bell icon to unsubscribe.
        </p>
        <p style="color: #9ca3af; font-size: 10px;">
          AI-generated analysis. May contain errors. Internal use only.
        </p>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface DigestResult {
  groupsScanned: number;
  emailsSent: number;
  groupsSkippedEmpty: number;
  groupsSkippedMissingView: number;
}

export const handler = async (): Promise<DigestResult> => {
  const subscriptions = await scanSubscriptions();
  const groups = groupByView(subscriptions);
  logger.info('saved_view_digest_run_started', {
    subscriptions: subscriptions.length,
    groups: groups.length,
  });

  let emailsSent = 0;
  let groupsSkippedEmpty = 0;
  let groupsSkippedMissingView = 0;
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  for (const group of groups) {
    try {
      // Resolve workspace → tenantUserId so we can locate the view + data.
      const workspace = await getItem<Workspace>(
        workspacePK(group.workspaceId),
        workspaceSK()
      );
      if (!workspace) {
        groupsSkippedMissingView++;
        logger.warn('saved_view_digest_workspace_missing', {
          workspaceId: group.workspaceId,
          viewId: group.viewId,
        });
        continue;
      }
      const tenantUserId = workspace.tenantUserId ?? workspace.ownerUserId;

      // Load the view itself.
      const view = await getItem<SavedView>(
        savedViewPK(tenantUserId),
        savedViewSK(group.viewId)
      );
      if (!view) {
        groupsSkippedMissingView++;
        logger.warn('saved_view_digest_view_missing', {
          workspaceId: group.workspaceId,
          viewId: group.viewId,
        });
        continue;
      }

      // Last-7-days changes via GSI1 (mirrors aggregate-changes.ts).
      const [changesResult, competitorsResult] = await Promise.all([
        queryGSI('GSI1', 'GSI1PK', tenantUserId, undefined, {
          skName: 'GSI1SK',
          skBetween: skPrefixRange('CHANGE#', sevenDaysAgo),
          limit: 200,
          scanForward: false,
        }),
        queryByPK(competitorPK(tenantUserId), 'COMP#'),
      ]);

      // Phase 23 — exclude self-brand from the competitor portfolio used to
      // build the snooze map. Saved-view digests are about RIVALS.
      const competitorRows = competitorsResult.items.filter((c) => c.targetKind !== 'self');
      const selfCompetitorIds = new Set(
        competitorsResult.items
          .filter((c) => c.targetKind === 'self')
          .map((c) => c.id as string)
      );

      // Snooze filter — drop changes whose competitor is currently snoozed.
      const snoozedNames = new Set(
        competitorRows
          .filter((c) => isSnoozed(c as { snoozedUntil?: string }))
          .map((c) => c.name as string)
      );

      const changes: ChangeRow[] = changesResult.items
        .filter((item) => !selfCompetitorIds.has(item.competitorId as string))
        .filter((item) => !snoozedNames.has(item.competitorName as string))
        .map((item) => {
          const a = item.aiAnalysis as Record<string, unknown> | undefined;
          return {
            id: item.id as string,
            competitorId: item.competitorId as string,
            competitorName: (item.competitorName as string) ?? '',
            pageUrl: (item.pageUrl as string) ?? '',
            significance: (item.significance as number) ?? 0,
            detectedAt: (item.detectedAt as string) ?? '',
            changeType: a?.changeType as string | undefined,
            summary: a?.summary as string | undefined,
          };
        });

      const filtered = applyViewFilters(changes, view.filters);
      filtered.sort((a, b) => b.significance - a.significance);

      if (filtered.length === 0) {
        groupsSkippedEmpty++;
        logger.info('saved_view_digest_empty_skipped', {
          workspaceId: group.workspaceId,
          viewId: group.viewId,
          subscribers: group.subscriptions.length,
        });
        continue;
      }

      const html = renderDigestHtml(view.name, filtered);
      const subject = `${view.name} — ${filtered.length} change${
        filtered.length === 1 ? '' : 's'
      } this week`;

      // Send to each subscriber + best-effort lastSentAt update.
      for (const sub of group.subscriptions) {
        try {
          await sendEmail(sub.subscriberEmail, subject, html);
          emailsSent++;
          await updateItem(
            savedViewSubscriptionPK(sub.subscriberUserId),
            savedViewSubscriptionSK(sub.workspaceId, sub.viewId),
            { lastSentAt: new Date().toISOString() }
          ).catch((err) =>
            logger.warn('saved_view_digest_lastSentAt_write_failed', {
              err: err instanceof Error ? err.message : String(err),
            })
          );
        } catch (err) {
          logger.warn('saved_view_digest_send_failed', {
            workspaceId: group.workspaceId,
            viewId: group.viewId,
            subscriberEmail: sub.subscriberEmail,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      logger.error('saved_view_digest_group_failed', {
        workspaceId: group.workspaceId,
        viewId: group.viewId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const result: DigestResult = {
    groupsScanned: groups.length,
    emailsSent,
    groupsSkippedEmpty,
    groupsSkippedMissingView,
  };
  logger.info('saved_view_digests_sent', { ...result });
  return result;
};
