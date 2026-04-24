#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/stacks/database.stack';
import { StorageStack } from '../lib/stacks/storage.stack';
import { AuthStack } from '../lib/stacks/auth.stack';
import { ApiStack } from '../lib/stacks/api.stack';
import { PipelineStack } from '../lib/stacks/pipeline.stack';
import { EmailStack } from '../lib/stacks/email.stack';
import { MonitoringStack } from '../lib/stacks/monitoring.stack';

if (!process.env.CDK_DEFAULT_ACCOUNT) {
  throw new Error('CDK_DEFAULT_ACCOUNT is not set. Run: export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)');
}
if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL is not set. Required for CORS. Example: export FRONTEND_URL=https://rivalscan.com');
}

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const stage = app.node.tryGetContext('stage') ?? 'dev';
const prefix = `RivalScan-${stage}`;

const databaseStack = new DatabaseStack(app, `${prefix}-Database`, { env });
const storageStack = new StorageStack(app, `${prefix}-Storage`, { env });
const authStack = new AuthStack(app, `${prefix}-Auth`, { env });

new EmailStack(app, `${prefix}-Email`, { env });

// Pipeline created first so we can pass the state machine ARN to ApiStack
const pipelineStack = new PipelineStack(app, `${prefix}-Pipeline`, {
  env,
  table: databaseStack.table,
  snapshotBucket: storageStack.snapshotBucket,
});

const apiStack = new ApiStack(app, `${prefix}-Api`, {
  env,
  table: databaseStack.table,
  snapshotBucket: storageStack.snapshotBucket,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  dailyStateMachine: pipelineStack.dailyStateMachine,
  researchStateMachine: pipelineStack.researchStateMachine,
});

new MonitoringStack(app, `${prefix}-Monitoring`, {
  env,
  table: databaseStack.table,
  api: apiStack.httpApi,
});

app.synth();
