/**
 * Scheduled Lambda — runs nightly (3am UTC) to roll up the prior day's
 * Anthropic API spend per user.
 *
 * Approach:
 *   1. List all Lambda log groups in this stack via DescribeLogGroups
 *      (filtered by `/aws/lambda/<stackName>-`).
 *   2. Run a single CloudWatch Logs Insights query that filters
 *      `ai_call_completed` events from the prior 24h, grouped by
 *      (userId, opName, model), summing input/output tokens + costUsd
 *      + call counts.
 *   3. Group results by userId and write a `CostDay` row (`PK=USER#<id>`,
 *      `SK=COST#<YYYY-MM-DD>`) per user.
 *   4. Update each affected user's `monthToDateCostUsd` cache + month
 *      rollover bookkeeping. The eligibility check reads this cache to
 *      gate further research when the monthly cap is exceeded.
 *
 * No Anthropic call attribution → discarded (logged but not aggregated).
 * The query runs against the prior calendar day in UTC, so a 3am-UTC
 * schedule gives Logs Insights enough write lag to have indexed every
 * event from the day we care about.
 */

import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  StartQueryCommand,
  GetQueryResultsCommand,
  type ResultField,
} from '@aws-sdk/client-cloudwatch-logs';
import { putItem, getItem, updateItem } from '../../shared/db/queries';
import { costDayPK, costDaySK, userPK, userSK } from '../../shared/db/keys';
import { logger } from '../../shared/utils/logger';

const cwLogs = new CloudWatchLogsClient({});

interface Aggregated {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byOpName: Record<
    string,
    {
      calls: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    }
  >;
}

const QUERY_LIMIT = 10000;
// CloudWatch Logs Insights caps log groups per query at 50 (most regions).
// We have well under 20 Lambdas in the stack today; pad with margin.
const MAX_LOG_GROUPS_PER_QUERY = 50;

async function listStackLogGroups(stackName: string): Promise<string[]> {
  const prefix = `/aws/lambda/${stackName}-`;
  const groups: string[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await cwLogs.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: prefix, nextToken })
    );
    for (const g of resp.logGroups ?? []) {
      if (g.logGroupName) groups.push(g.logGroupName);
    }
    nextToken = resp.nextToken;
  } while (nextToken);
  return groups;
}

async function runInsightsQuery(
  logGroups: string[],
  startMs: number,
  endMs: number
): Promise<ResultField[][]> {
  if (logGroups.length === 0) return [];

  const queryString = `
    filter message = "ai_call_completed" and status = "ok"
    | stats sum(inputTokens) as inputTokens,
            sum(outputTokens) as outputTokens,
            sum(costUsd) as costUsd,
            count(*) as calls
        by userId, opName, model
    | limit ${QUERY_LIMIT}
  `;

  const start = await cwLogs.send(
    new StartQueryCommand({
      logGroupNames: logGroups.slice(0, MAX_LOG_GROUPS_PER_QUERY),
      startTime: Math.floor(startMs / 1000),
      endTime: Math.floor(endMs / 1000),
      queryString,
      limit: QUERY_LIMIT,
    })
  );

  const queryId = start.queryId;
  if (!queryId) throw new Error('CloudWatch Logs StartQuery returned no queryId');

  // Poll until complete. Insights typically resolves in <10s for our volume,
  // but allow up to 90s of polling to be safe.
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const result = await cwLogs.send(new GetQueryResultsCommand({ queryId }));
    if (result.status === 'Complete') return result.results ?? [];
    if (result.status === 'Failed' || result.status === 'Cancelled' || result.status === 'Timeout') {
      throw new Error(`CloudWatch Logs query ${result.status}`);
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error('CloudWatch Logs query exceeded 90s polling deadline');
}

function groupByUser(
  rows: ResultField[][]
): Map<string, Aggregated> {
  const byUser = new Map<string, Aggregated>();
  for (const row of rows) {
    const map = new Map<string, string>();
    for (const f of row) if (f.field && f.value !== undefined) map.set(f.field, f.value);

    const userId = map.get('userId') ?? '';
    if (!userId || userId === '-' || userId === 'null') continue; // unattributable

    const opName = map.get('opName') ?? 'unknown';
    const calls = Number(map.get('calls') ?? '0');
    const inputTokens = Number(map.get('inputTokens') ?? '0');
    const outputTokens = Number(map.get('outputTokens') ?? '0');
    const costUsd = Number(map.get('costUsd') ?? '0');

    if (!Number.isFinite(calls) || !Number.isFinite(costUsd)) continue;

    let agg = byUser.get(userId);
    if (!agg) {
      agg = {
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: 0,
        byOpName: {},
      };
      byUser.set(userId, agg);
    }
    agg.totalCalls += calls;
    agg.totalInputTokens += inputTokens;
    agg.totalOutputTokens += outputTokens;
    agg.totalCostUsd += costUsd;
    const op = (agg.byOpName[opName] ??= {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    });
    op.calls += calls;
    op.inputTokens += inputTokens;
    op.outputTokens += outputTokens;
    op.costUsd += costUsd;
  }
  return byUser;
}

/** Compute the prior-day window in UTC, returning {date, startMs, endMs}. */
function priorDayWindow(now: Date): { date: string; startMs: number; endMs: number } {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0); // start of today UTC = end of prior day
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 1);
  return {
    date: start.toISOString().slice(0, 10), // YYYY-MM-DD
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
}

async function writeCostDay(
  userId: string,
  date: string,
  agg: Aggregated
): Promise<void> {
  // 90-day TTL, expressed as epoch seconds for DynamoDB TTL attribute
  const expiresAt = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

  await putItem({
    PK: costDayPK(userId),
    SK: costDaySK(date),
    date,
    userId,
    totalCalls: agg.totalCalls,
    totalInputTokens: agg.totalInputTokens,
    totalOutputTokens: agg.totalOutputTokens,
    totalCostUsd: Number(agg.totalCostUsd.toFixed(6)),
    byOpName: agg.byOpName,
    expiresAt,
  });
}

async function updateUserMonthToDate(
  userId: string,
  forDate: string,
  costToAdd: number
): Promise<void> {
  // Cheap read-then-write. Race window is tolerable because this Lambda
  // runs once per day, single-instance.
  const month = forDate.slice(0, 7); // 'YYYY-MM'

  const userRecord = await getItem<Record<string, unknown>>(userPK(userId), userSK());
  if (!userRecord) {
    logger.warn('aggregate-ai-costs: user record missing — skipping monthToDate update', {
      userId,
    });
    return;
  }

  const cachedMonth =
    typeof userRecord.monthToDateCostMonth === 'string'
      ? userRecord.monthToDateCostMonth
      : undefined;
  const cachedCost =
    typeof userRecord.monthToDateCostUsd === 'number' ? userRecord.monthToDateCostUsd : 0;

  const newMonthToDate = cachedMonth === month ? cachedCost + costToAdd : costToAdd;

  await updateItem(userPK(userId), userSK(), {
    monthToDateCostUsd: Number(newMonthToDate.toFixed(6)),
    monthToDateCostMonth: month,
    updatedAt: new Date().toISOString(),
  });
}

export const handler = async (): Promise<{
  date: string;
  usersAggregated: number;
  totalCalls: number;
  totalCostUsd: number;
}> => {
  const stackName = process.env.STACK_NAME;
  if (!stackName) throw new Error('STACK_NAME env var is required');

  const window = priorDayWindow(new Date());
  logger.info('aggregate-ai-costs started', {
    date: window.date,
    startMs: window.startMs,
    endMs: window.endMs,
  });

  const logGroups = await listStackLogGroups(stackName);
  if (logGroups.length === 0) {
    logger.warn('aggregate-ai-costs: no Lambda log groups discovered for stack', { stackName });
    return { date: window.date, usersAggregated: 0, totalCalls: 0, totalCostUsd: 0 };
  }

  if (logGroups.length > MAX_LOG_GROUPS_PER_QUERY) {
    // Defensive — today we have <20 Lambdas, but if the stack grows past 50
    // we'll need to issue multiple queries and merge results. Surface as a
    // warning so we can split before it silently truncates data.
    logger.warn('aggregate-ai-costs: log group count exceeds single-query cap; truncating', {
      count: logGroups.length,
      cap: MAX_LOG_GROUPS_PER_QUERY,
    });
  }

  const rows = await runInsightsQuery(logGroups, window.startMs, window.endMs);
  const byUser = groupByUser(rows);

  let totalCalls = 0;
  let totalCostUsd = 0;
  for (const [userId, agg] of byUser) {
    await writeCostDay(userId, window.date, agg);
    await updateUserMonthToDate(userId, window.date, agg.totalCostUsd);
    totalCalls += agg.totalCalls;
    totalCostUsd += agg.totalCostUsd;
  }

  const result = {
    date: window.date,
    usersAggregated: byUser.size,
    totalCalls,
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
  };
  logger.info('aggregate-ai-costs completed', result);
  return result;
};
