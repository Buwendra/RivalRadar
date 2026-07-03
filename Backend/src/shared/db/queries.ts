import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './client';

/** Get a single item by PK + SK */
export async function getItem<T>(pk: string, sk: string): Promise<T | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
    })
  );
  return (result.Item as T) ?? null;
}

/** Put an item (create or overwrite) */
export async function putItem(item: Record<string, unknown>): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}

/** Put an item only if it doesn't already exist (idempotent create) */
export async function putItemIfNotExists(item: Record<string, unknown>): Promise<boolean> {
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
      return false;
    }
    throw err;
  }
}

/** Delete an item by PK + SK */
export async function deleteItem(pk: string, sk: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
    })
  );
}

/**
 * Highest code point that can appear in our sort keys. Used as the inclusive
 * upper bound of a prefix-scoped range so a `>=` query cannot bleed into the
 * next SK namespace (e.g. `GSI1SK >= 'CHANGE#<iso>'` alone would also match
 * every `REC#`/`RESEARCH#` row, because those sort after all `CHANGE#…`).
 */
const SK_RANGE_MAX = '￿';

/**
 * Build an `skBetween` range meaning "every key under `prefix` from `since`
 * onward" — e.g. `skPrefixRange('CHANGE#', sevenDaysAgoIso)` matches
 * `CHANGE#<sevenDaysAgo>` … `CHANGE#<latest>` and nothing outside `CHANGE#`.
 */
export function skPrefixRange(prefix: string, since: string): [string, string] {
  return [`${prefix}${since}`, `${prefix}${SK_RANGE_MAX}`];
}

function buildSkCondition(
  skAttr: string,
  skPrefix?: string,
  skBetween?: [string, string]
): { condition: string; values: Record<string, unknown> } {
  if (skPrefix && skBetween) {
    throw new Error('skPrefix and skBetween are mutually exclusive');
  }
  if (skBetween) {
    return {
      condition: ` AND ${skAttr} BETWEEN :skLo AND :skHi`,
      values: { ':skLo': skBetween[0], ':skHi': skBetween[1] },
    };
  }
  if (skPrefix) {
    return {
      condition: ` AND begins_with(${skAttr}, :skPrefix)`,
      values: { ':skPrefix': skPrefix },
    };
  }
  return { condition: '', values: {} };
}

/** Query items by PK with optional SK prefix or SK range */
export async function queryByPK(
  pk: string,
  skPrefix?: string,
  options?: {
    limit?: number;
    scanForward?: boolean;
    cursor?: string;
    /** Inclusive SK range (use `skPrefixRange()` to build). Exclusive with skPrefix. */
    skBetween?: [string, string];
  }
): Promise<{ items: Record<string, unknown>[]; cursor?: string }> {
  const sk = buildSkCondition('SK', skPrefix, options?.skBetween);
  const params: Record<string, unknown> = {
    TableName: TABLE_NAME,
    KeyConditionExpression: `PK = :pk${sk.condition}`,
    ExpressionAttributeValues: { ':pk': pk, ...sk.values },
    ScanIndexForward: options?.scanForward ?? false,
  };

  if (options?.limit) params.Limit = options.limit;
  if (options?.cursor) {
    params.ExclusiveStartKey = JSON.parse(
      Buffer.from(options.cursor, 'base64url').toString()
    );
  }

  const result = await ddb.send(new QueryCommand(params as never));

  return {
    items: (result.Items as Record<string, unknown>[]) ?? [],
    cursor: result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url')
      : undefined,
  };
}

/** Query a GSI with optional SK prefix or SK range */
export async function queryGSI(
  indexName: string,
  pkName: string,
  pkValue: string,
  skPrefix?: string,
  options?: {
    skName?: string;
    limit?: number;
    scanForward?: boolean;
    cursor?: string;
    /** Inclusive SK range (use `skPrefixRange()` to build). Exclusive with skPrefix. */
    skBetween?: [string, string];
  }
): Promise<{ items: Record<string, unknown>[]; cursor?: string }> {
  const skName = options?.skName ?? `${pkName.replace('PK', 'SK')}`;
  const sk = buildSkCondition(skName, skPrefix, options?.skBetween);

  const params: Record<string, unknown> = {
    TableName: TABLE_NAME,
    IndexName: indexName,
    KeyConditionExpression: `${pkName} = :pk${sk.condition}`,
    ExpressionAttributeValues: { ':pk': pkValue, ...sk.values },
    ScanIndexForward: options?.scanForward ?? false,
  };

  if (options?.limit) params.Limit = options.limit;
  if (options?.cursor) {
    params.ExclusiveStartKey = JSON.parse(
      Buffer.from(options.cursor, 'base64url').toString()
    );
  }

  const result = await ddb.send(new QueryCommand(params as never));

  return {
    items: (result.Items as Record<string, unknown>[]) ?? [],
    cursor: result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url')
      : undefined,
  };
}

/** Update specific attributes on an item */
export async function updateItem(
  pk: string,
  sk: string,
  updates: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(updates);
  const expression = keys.map((_k, i) => `#k${i} = :v${i}`).join(', ');
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  keys.forEach((key, i) => {
    names[`#k${i}`] = key;
    values[`:v${i}`] = updates[key];
  });

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
      UpdateExpression: `SET ${expression}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

/**
 * Atomic increment of one numeric attribute, with optional SETs on others.
 * Powers the real-time cost-cap update (Issue 7) and the rate-limit token
 * bucket (Issue 8). DDB's ADD is the only way to safely increment under
 * concurrent writes — `SET x = x + 1` race-loses.
 */
/**
 * Atomic increment scoped to a guard window (month, day, …).
 *
 * ADDs `delta` to `attr` only while `guard.attr === guard.value` still holds
 * on the row; when the guard has moved on (new month/day) or was never set,
 * the counter is atomically RESET to `delta` and the guard re-stamped.
 * This is what `atomicAdd`-with-a-SET-guard gets wrong: a plain ADD keeps
 * accumulating across the boundary while the SET silently relabels the stale
 * total as belonging to the new window.
 */
export async function atomicAddGuarded(
  pk: string,
  sk: string,
  attr: string,
  delta: number,
  guard: { attr: string; value: unknown },
  setAttrs: Record<string, unknown> = {}
): Promise<void> {
  const names: Record<string, string> = { '#a': attr, '#g': guard.attr };
  const values: Record<string, unknown> = { ':d': delta, ':g': guard.value };

  const setKeys = Object.keys(setAttrs);
  const extraSet = setKeys.map((_k, i) => `, #s${i} = :s${i}`).join('');
  setKeys.forEach((key, i) => {
    names[`#s${i}`] = key;
    values[`:s${i}`] = setAttrs[key];
  });

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: `ADD #a :d SET #g = :g${extraSet}`,
        ConditionExpression: '#g = :g',
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );
  } catch (err: unknown) {
    if (!(err instanceof Error && err.name === 'ConditionalCheckFailedException')) {
      throw err;
    }
    // Window rolled over (or first write ever): reset the counter for the new
    // window. If two writers race here, last-writer-wins loses one delta —
    // acceptable for rollup caches that are reconciled nightly.
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: `SET #a = :d, #g = :g${extraSet}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );
  }
}

export async function atomicAdd(
  pk: string,
  sk: string,
  attr: string,
  delta: number,
  setAttrs: Record<string, unknown> = {}
): Promise<void> {
  const names: Record<string, string> = { '#a': attr };
  const values: Record<string, unknown> = { ':d': delta };

  const setKeys = Object.keys(setAttrs);
  const setExpr = setKeys
    .map((_k, i) => `#s${i} = :s${i}`)
    .join(', ');
  setKeys.forEach((key, i) => {
    names[`#s${i}`] = key;
    values[`:s${i}`] = setAttrs[key];
  });

  const updateExpression = setExpr
    ? `ADD #a :d SET ${setExpr}`
    : `ADD #a :d`;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}
