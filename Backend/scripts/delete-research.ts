/**
 * One-shot utility: delete a specific ResearchFinding by PK+SK.
 *
 * Usage:
 *   TABLE_NAME=RivalScan-dev-Database-Table npx ts-node scripts/delete-research.ts \
 *     COMP#<competitorId> RESEARCH#<timestamp>
 *
 * Or, with --latest to delete the most recent finding for a competitor name:
 *   TABLE_NAME=... npx ts-node scripts/delete-research.ts --latest Deepseek
 */
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
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

async function findCompetitorByName(nameFragment: string): Promise<{
  competitorId: string;
  name: string;
} | null> {
  let cursor: Record<string, unknown> | undefined;
  const matches: Array<{ competitorId: string; name: string }> = [];
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: 'begins_with(SK, :compPrefix) AND contains(#n, :frag)',
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
      'Multiple competitors matched:',
      matches.map((m) => `${m.name} (${m.competitorId})`).join(', ')
    );
    process.exit(1);
  }
  return matches[0];
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    console.error('Usage: (PK SK) | (--latest <name>)');
    process.exit(1);
  }

  let pk: string;
  let sk: string;

  if (argv[0] === '--latest') {
    const comp = await findCompetitorByName(argv[1]);
    if (!comp) {
      console.error(`No competitor matched "${argv[1]}"`);
      process.exit(1);
    }
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `COMP#${comp.competitorId}`,
          ':sk': 'RESEARCH#',
        },
        ScanIndexForward: false,
        Limit: 1,
      })
    );
    const latest = result.Items?.[0];
    if (!latest) {
      console.error('No research findings exist for this competitor.');
      process.exit(1);
    }
    pk = String(latest.PK);
    sk = String(latest.SK);
    console.log(`Latest finding for ${comp.name}: ${pk} / ${sk}`);
  } else {
    pk = argv[0];
    sk = argv[1];
  }

  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }));
  console.log(`Deleted ${pk} / ${sk}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
