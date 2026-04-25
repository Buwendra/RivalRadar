/**
 * One-shot utility: trim half the items from each category of the latest
 * ResearchFinding for a named competitor, so the next "Research Now" click
 * detects the removed items as new deltas and populates the dashboard.
 *
 * Usage:
 *   TABLE_NAME=RivalScan-dev-Database-Table npx ts-node scripts/trim-research.ts Deepseek
 */
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.TABLE_NAME;
if (!TABLE) {
  console.error('TABLE_NAME env var required');
  process.exit(1);
}

const raw = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

type FindingItem = {
  title: string;
  detail: string;
  sourceUrl?: string;
  importance: 1 | 2 | 3;
};
type Categories = {
  news: FindingItem[];
  product: FindingItem[];
  funding: FindingItem[];
  hiring: FindingItem[];
  social: FindingItem[];
};

async function findCompetitorByName(nameFragment: string): Promise<{
  competitorId: string;
  name: string;
} | null> {
  const matches: Array<{ competitorId: string; name: string }> = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression:
          'begins_with(SK, :compPrefix) AND contains(#n, :frag)',
        ExpressionAttributeNames: { '#n': 'name' },
        ExpressionAttributeValues: {
          ':compPrefix': { S: 'COMP#' },
          ':frag': { S: nameFragment },
        },
        ExclusiveStartKey: cursor as never,
      })
    );
    for (const item of result.Items ?? []) {
      const id = item.id?.S;
      const name = item.name?.S;
      if (id && name) matches.push({ competitorId: id, name });
    }
    cursor = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.error(
      `Multiple competitors matched "${nameFragment}":`,
      matches.map((m) => `${m.name} (${m.competitorId})`).join(', ')
    );
    process.exit(1);
  }
  return matches[0];
}

async function loadLatestFinding(
  competitorId: string
): Promise<Record<string, unknown> | null> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `COMP#${competitorId}`,
        ':sk': 'RESEARCH#',
      },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  return (result.Items?.[0] as Record<string, unknown>) ?? null;
}

function trimCategory(items: FindingItem[]): {
  kept: FindingItem[];
  removed: FindingItem[];
} {
  if (items.length <= 1) return { kept: items, removed: [] };
  const keep = Math.ceil(items.length / 2);
  return { kept: items.slice(0, keep), removed: items.slice(keep) };
}

async function main() {
  const nameFragment = process.argv[2] ?? 'Deepseek';
  console.log(`Looking up competitor matching "${nameFragment}"...`);

  const comp = await findCompetitorByName(nameFragment);
  if (!comp) {
    console.error(`No competitor matched "${nameFragment}"`);
    process.exit(1);
  }
  console.log(`Found: ${comp.name} (${comp.competitorId})`);

  const finding = await loadLatestFinding(comp.competitorId);
  if (!finding) {
    console.error('No ResearchFinding exists for this competitor yet.');
    process.exit(1);
  }

  const categories = finding.categories as Categories;
  const keys: Array<keyof Categories> = ['news', 'product', 'funding', 'hiring', 'social'];

  console.log('\nCurrent category counts:');
  for (const k of keys) console.log(`  ${k.padEnd(8)} ${categories[k].length}`);

  const trimmed: Categories = {
    news: [],
    product: [],
    funding: [],
    hiring: [],
    social: [],
  };
  const removedLog: string[] = [];
  for (const k of keys) {
    const { kept, removed } = trimCategory(categories[k]);
    trimmed[k] = kept;
    for (const r of removed) removedLog.push(`  ${k}: ${r.title}`);
  }

  console.log('\nRemoving these items (so next research detects them as new):');
  if (removedLog.length === 0) {
    console.log('  (nothing to remove — every category had 1 or 0 items)');
    process.exit(0);
  }
  console.log(removedLog.join('\n'));

  console.log('\nKept category counts (after trim):');
  for (const k of keys) console.log(`  ${k.padEnd(8)} ${trimmed[k].length}`);

  // Write back with same PK / SK, replacing categories only
  const updated = { ...finding, categories: trimmed };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: updated }));
  console.log(
    `\nDone. Wrote trimmed ResearchFinding back to ${finding.PK} / ${finding.SK}.`
  );
  console.log(
    'Click "Research Now" on this competitor — the new research will detect the removed items and emit Change records with citations.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
