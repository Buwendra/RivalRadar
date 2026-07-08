/**
 * One-shot demo seeder for buwendra.s@gmail.com (Command tier).
 *
 * Adds:
 *   1. Two new competitors (Perplexity, Mistral) as DDB Competitor rows.
 *   2. A self-brand row (Phase 23) + companyWebsite on the User record so
 *      the Your Brand / Brand Health / Share of Voice surfaces light up.
 *
 * Then triggers a single ResearchPipeline execution covering ALL six
 * competitors (the three existing ones + two new + the self-brand row).
 * The state machine's Map has maxConcurrency=1 so this runs serially —
 * ~2-3 min per competitor, ~12-18 min total wall-clock, ~$1.80 in
 * Anthropic spend.
 *
 * Usage (from Backend/):
 *   set -a && source .env && set +a
 *   TABLE_NAME=Kironyx-dev-Database-Table \
 *   RESEARCH_PIPELINE_ARN=arn:aws:states:us-east-1:076561717141:stateMachine:Kironyx-dev-Pipeline-ResearchPipeline \
 *   npx ts-node scripts/seed-demo-data.ts
 *
 * Idempotent on re-run: skips competitors that already exist by name and
 * the self-brand row if `targetKind: 'self'` is already present.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { generateId } from '../src/shared/utils/id';

const TABLE = process.env.TABLE_NAME;
const SM_ARN = process.env.RESEARCH_PIPELINE_ARN;
const USER_ID = '01KPWTQZHS6J9FZF7XM268MTEQ'; // buwendra.s@gmail.com
const REGION = process.env.AWS_REGION ?? 'us-east-1';

if (!TABLE) {
  console.error('TABLE_NAME env var required');
  process.exit(1);
}
if (!SM_ARN) {
  console.error('RESEARCH_PIPELINE_ARN env var required');
  process.exit(1);
}

const raw = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});
const sfn = new SFNClient({ region: REGION });

interface CompetitorSeed {
  name: string;
  url: string;
  pagesToTrack: string[];
  targetKind: 'competitor' | 'self';
}

interface CompetitorRow {
  id: string;
  name: string;
  url: string;
  targetKind?: 'competitor' | 'self';
}

const COMPETITORS_TO_ADD: CompetitorSeed[] = [
  {
    name: 'Perplexity',
    url: 'https://www.perplexity.ai',
    pagesToTrack: ['homepage', 'features', 'pricing', 'blog'],
    targetKind: 'competitor',
  },
  {
    name: 'Mistral',
    url: 'https://mistral.ai',
    pagesToTrack: ['homepage', 'features', 'pricing', 'blog'],
    targetKind: 'competitor',
  },
];

const SELF_BRAND: CompetitorSeed = {
  name: 'Kironyx',
  url: 'https://kironyx.com',
  pagesToTrack: ['homepage'],
  targetKind: 'self',
};

async function loadExistingCompetitors(): Promise<CompetitorRow[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${USER_ID}`,
        ':sk': 'COMP#',
      },
      ProjectionExpression: 'id, #n, #u, targetKind',
      ExpressionAttributeNames: { '#n': 'name', '#u': 'url' },
    })
  );
  return (out.Items ?? []) as CompetitorRow[];
}

async function createCompetitorRow(seed: CompetitorSeed): Promise<CompetitorRow> {
  const id = generateId();
  const now = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `USER#${USER_ID}`,
        SK: `COMP#${id}`,
        id,
        userId: USER_ID,
        name: seed.name,
        url: seed.url,
        pagesToTrack: seed.pagesToTrack,
        status: 'active',
        targetKind: seed.targetKind,
        createdAt: now,
        updatedAt: now,
        GSI2PK: 'ACTIVE',
        GSI2SK: `COMP#${id}`,
      },
    })
  );
  console.log(`+ created ${seed.targetKind}: ${seed.name} (${id})`);
  return { id, name: seed.name, url: seed.url, targetKind: seed.targetKind };
}

async function ensureCompanyWebsiteOnUser(): Promise<void> {
  const u = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${USER_ID}`, SK: 'PROFILE' },
    })
  );
  if (!u.Item) throw new Error('User row not found');
  if (u.Item.companyWebsite) {
    console.log(`= companyWebsite already set: ${u.Item.companyWebsite}`);
    return;
  }
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `USER#${USER_ID}`, SK: 'PROFILE' },
      UpdateExpression: 'SET companyWebsite = :w, updatedAt = :n',
      ExpressionAttributeValues: {
        ':w': SELF_BRAND.url,
        ':n': new Date().toISOString(),
      },
    })
  );
  console.log(`+ set companyWebsite = ${SELF_BRAND.url}`);
}

async function main() {
  const existing = await loadExistingCompetitors();
  console.log(`existing competitors: ${existing.length}`);
  for (const c of existing) {
    console.log(`  - ${c.name} (${c.id}, ${c.targetKind ?? 'competitor'})`);
  }

  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  const selfBrandExists = existing.some((c) => c.targetKind === 'self');

  // ── 1. Add Perplexity + Mistral if missing ──
  const newRows: CompetitorRow[] = [];
  for (const seed of COMPETITORS_TO_ADD) {
    const dup = byName.get(seed.name.toLowerCase());
    if (dup) {
      console.log(`= competitor already exists: ${seed.name} (${dup.id})`);
      continue;
    }
    newRows.push(await createCompetitorRow(seed));
  }

  // ── 2. Add self-brand row + companyWebsite on User if missing ──
  let selfRow: CompetitorRow | undefined;
  if (!selfBrandExists) {
    selfRow = await createCompetitorRow(SELF_BRAND);
    await ensureCompanyWebsiteOnUser();
  } else {
    selfRow = existing.find((c) => c.targetKind === 'self');
    console.log(`= self-brand row already exists: ${selfRow?.name}`);
    await ensureCompanyWebsiteOnUser();
  }

  // ── 3. Build the Step Function input — every competitor row, both
  // the freshly-created ones and the existing ones we want to refresh ──
  const refreshed = await loadExistingCompetitors();
  const pipelineInput = {
    competitors: refreshed
      .filter((c) => !!c.url)
      .map((c) => ({
        competitorId: c.id,
        userId: USER_ID,
        tenantUserId: USER_ID,
        name: c.name,
        url: c.url,
        ...(c.targetKind === 'self' ? { targetKind: 'self' as const } : {}),
      })),
  };

  console.log(`\npipeline input: ${pipelineInput.competitors.length} competitors`);
  pipelineInput.competitors.forEach((c) => {
    const kind = (c as { targetKind?: string }).targetKind ?? 'competitor';
    console.log(`  - ${c.name} (${c.competitorId}, ${kind})`);
  });

  const result = await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: SM_ARN,
      input: JSON.stringify(pipelineInput),
    })
  );
  console.log(`\n→ pipeline started: ${result.executionArn}`);
  console.log('  watch with: aws stepfunctions describe-execution --execution-arn <arn>');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
