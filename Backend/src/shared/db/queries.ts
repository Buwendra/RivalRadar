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

/** Query items by PK with optional SK prefix */
export async function queryByPK(
  pk: string,
  skPrefix?: string,
  options?: {
    limit?: number;
    scanForward?: boolean;
    cursor?: string;
  }
): Promise<{ items: Record<string, unknown>[]; cursor?: string }> {
  const params: Record<string, unknown> = {
    TableName: TABLE_NAME,
    KeyConditionExpression: skPrefix
      ? 'PK = :pk AND begins_with(SK, :skPrefix)'
      : 'PK = :pk',
    ExpressionAttributeValues: skPrefix
      ? { ':pk': pk, ':skPrefix': skPrefix }
      : { ':pk': pk },
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

/** Query a GSI */
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
  }
): Promise<{ items: Record<string, unknown>[]; cursor?: string }> {
  const skName = options?.skName ?? `${pkName.replace('PK', 'SK')}`;

  const params: Record<string, unknown> = {
    TableName: TABLE_NAME,
    IndexName: indexName,
    KeyConditionExpression: skPrefix
      ? `${pkName} = :pk AND begins_with(${skName}, :skPrefix)`
      : `${pkName} = :pk`,
    ExpressionAttributeValues: skPrefix
      ? { ':pk': pkValue, ':skPrefix': skPrefix }
      : { ':pk': pkValue },
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
