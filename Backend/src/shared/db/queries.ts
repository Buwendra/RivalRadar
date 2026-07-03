import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './client';

/**
 * DynamoDB's hard ceiling on items per TransactWriteItems call. Callers must
 * stay under it — `transactWrite` throws rather than silently splitting,
 * because a split would forfeit exactly the atomicity the caller asked for.
 */
export const TRANSACT_MAX_ITEMS = 100;

/**
 * Put a batch of items as ONE atomic commit — all rows land or none do.
 * Used where partial persistence corrupts derived state (e.g. a research
 * finding without its Change rows becomes a baseline that permanently hides
 * those deltas from re-detection).
 */
export async function transactWrite(items: Array<Record<string, unknown>>): Promise<void> {
  if (items.length === 0) return;
  if (items.length > TRANSACT_MAX_ITEMS) {
    throw new Error(
      `transactWrite: ${items.length} items exceeds DynamoDB's ${TRANSACT_MAX_ITEMS}-item transaction limit`
    );
  }
  await ddb.send(
    new TransactWriteCommand({
      TransactItems: items.map((item) => ({
        Put: { TableName: TABLE_NAME, Item: item },
      })),
    })
  );
}

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
 * Client-controlled pagination cursor failed to decode or was rejected by
 * DynamoDB. Carries statusCode/code so apiHandler's duck-typed mapping turns
 * it into a 400 VALIDATION response instead of a 500 (queries.ts can't import
 * HttpError from the middleware without inverting the layering).
 */
export class InvalidCursorError extends Error {
  statusCode = 400;
  code = 'INVALID_CURSOR';
  constructor() {
    super('Invalid pagination cursor');
    this.name = 'InvalidCursorError';
  }
}

function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new InvalidCursorError();
  }
}

/** DDB rejects a structurally-valid but wrong ExclusiveStartKey with a ValidationException. */
function isDdbValidationError(err: unknown): boolean {
  return err instanceof Error && err.name === 'ValidationException';
}

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
    params.ExclusiveStartKey = decodeCursor(options.cursor);
  }

  let result;
  try {
    result = await ddb.send(new QueryCommand(params as never));
  } catch (err) {
    if (options?.cursor && isDdbValidationError(err)) throw new InvalidCursorError();
    throw err;
  }

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
    params.ExclusiveStartKey = decodeCursor(options.cursor);
  }

  let result;
  try {
    result = await ddb.send(new QueryCommand(params as never));
  } catch (err) {
    if (options?.cursor && isDdbValidationError(err)) throw new InvalidCursorError();
    throw err;
  }

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

/**
 * Race-free bounded counter increment: ADD 1 to `attr` only while it is
 * strictly below `max`. Returns false when the ceiling is hit. This is the
 * plan-limit enforcement primitive — the old read-count-then-put pattern let
 * two concurrent creates both pass the check and land max+1 rows.
 *
 * The attribute must already exist (callers lazy-init it from a row count
 * via `initCounterIfAbsent`); a missing attribute fails the condition rather
 * than silently starting a fresh count at 1 under an existing portfolio.
 */
export async function incrementWithCeiling(
  pk: string,
  sk: string,
  attr: string,
  max: number,
  count = 1
): Promise<boolean> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'ADD #a :d',
        // Claim `count` slots atomically: current + count <= max.
        ConditionExpression: 'attribute_exists(#a) AND #a <= :headroom',
        ExpressionAttributeNames: { '#a': attr },
        ExpressionAttributeValues: { ':d': count, ':headroom': max - count },
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

/**
 * Escape hatch for one-off conditional writes that don't fit the shaped
 * helpers above. Returns false when the condition failed, true when the
 * update applied; rethrows anything else.
 */
export async function conditionalUpdate(args: {
  pk: string;
  sk: string;
  update: string;
  condition: string;
  names: Record<string, string>;
  values: Record<string, unknown>;
}): Promise<boolean> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: args.pk, SK: args.sk },
        UpdateExpression: args.update,
        ConditionExpression: args.condition,
        ExpressionAttributeNames: args.names,
        ExpressionAttributeValues: args.values,
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

/** Append values to a list attribute, creating it when absent. */
export async function appendToList(
  pk: string,
  sk: string,
  attr: string,
  values: unknown[]
): Promise<void> {
  if (values.length === 0) return;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
      UpdateExpression: 'SET #a = list_append(if_not_exists(#a, :empty), :new)',
      ExpressionAttributeNames: { '#a': attr },
      ExpressionAttributeValues: { ':empty': [], ':new': values },
    })
  );
}

/** Seed a counter attribute exactly once; concurrent initializers lose silently. */
export async function initCounterIfAbsent(
  pk: string,
  sk: string,
  attr: string,
  value: number
): Promise<void> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'SET #a = :v',
        ConditionExpression: 'attribute_not_exists(#a)',
        ExpressionAttributeNames: { '#a': attr },
        ExpressionAttributeValues: { ':v': value },
      })
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
      return; // someone else initialized — theirs wins
    }
    throw err;
  }
}

/** Decrement a counter without going below zero; no-ops when absent. */
export async function decrementFloorZero(pk: string, sk: string, attr: string): Promise<void> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'ADD #a :minus',
        ConditionExpression: 'attribute_exists(#a) AND #a > :zero',
        ExpressionAttributeNames: { '#a': attr },
        ExpressionAttributeValues: { ':minus': -1, ':zero': 0 },
      })
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
      return;
    }
    throw err;
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
