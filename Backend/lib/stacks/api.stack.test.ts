/**
 * Template-assertion test for the Api stack — the only automated gate on the
 * synthesized route table, since `cdk synth` deliberately never runs in CI.
 *
 * What it protects against:
 *  - a dropped/renamed route or auth-flag drift between the manifest and the
 *    gateway (assertion: routeKey set + per-route authorization type);
 *  - resource-count regrowth toward CloudFormation's hard 500 limit (the
 *    per-route layout synthesized 588 and could not deploy);
 *  - losing integration/permission reuse (a fresh HttpLambdaIntegration per
 *    route, or dropping scopePermissionToRoute: false, silently triples the
 *    per-route resource cost — exact counts catch it);
 *  - privileged IAM (AdminDeleteUser, StartExecution, SFN/log reads, SES)
 *    leaking onto functions other than their dedicated owners;
 *  - a router entry-path typo (NodejsFunction validates entries at construct
 *    time even with bundling disabled).
 *
 * Bundling is disabled via the 'aws:cdk:bundling-stacks' context — otherwise
 * Template.fromStack() would run esbuild for all 20 routers on every test run.
 */
import { describe, expect, it } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { ApiStack } from './api.stack';
import { FNS, ROUTES, FnId } from '../../src/functions/route-manifest';

const FN_IDS = Object.keys(FNS) as FnId[];
const ENV = { account: '111111111111', region: 'us-east-1' };

function synthApiStack(): Template {
  const app = new cdk.App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const fixture = new cdk.Stack(app, 'Fixture', { env: ENV });

  const table = new dynamodb.Table(fixture, 'Table', {
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  });
  const snapshotBucket = new s3.Bucket(fixture, 'Bucket');
  const userPool = new cognito.UserPool(fixture, 'Pool');
  const userPoolClient = userPool.addClient('Client');
  const researchStateMachine = new sfn.StateMachine(fixture, 'Research', {
    definitionBody: sfn.DefinitionBody.fromChainable(new sfn.Pass(fixture, 'Noop')),
  });
  const deepResearchFn = new lambda.Function(fixture, 'DeepResearch', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler = async () => {};'),
  });

  const stack = new ApiStack(app, 'TestApi', {
    env: ENV,
    table,
    snapshotBucket,
    userPool,
    userPoolClient,
    researchStateMachine,
    deepResearchFn,
  });
  return Template.fromStack(stack);
}

const template = synthApiStack();
const resources = template.toJSON().Resources as Record<
  string,
  { Type: string; Properties?: Record<string, any> }
>;

function resourcesOfType(type: string): [string, { Type: string; Properties?: any }][] {
  return Object.entries(resources).filter(([, r]) => r.Type === type);
}

/** Longest-prefix FnId match, so ResearchRunsDetails' role isn't attributed
 *  to ResearchRuns. */
function fnOwner(logicalId: string): FnId | undefined {
  return FN_IDS.filter((id) => logicalId.startsWith(id)).sort(
    (a, b) => b.length - a.length
  )[0];
}

function statementsOf(policy: { Properties?: any }): { actions: string[]; roles: string[] }[] {
  const stmts = policy.Properties?.PolicyDocument?.Statement ?? [];
  const roles = (policy.Properties?.Roles ?? []).map(
    (r: { Ref?: string }) => r.Ref ?? String(r)
  );
  return stmts.map((s: { Action: string | string[] }) => ({
    actions: Array.isArray(s.Action) ? s.Action : [s.Action],
    roles,
  }));
}

/** FnIds whose IAM policies contain the given action. */
function fnsWithAction(action: string): FnId[] {
  const owners = new Set<FnId>();
  for (const [, policy] of resourcesOfType('AWS::IAM::Policy')) {
    for (const stmt of statementsOf(policy)) {
      if (!stmt.actions.includes(action)) continue;
      for (const role of stmt.roles) {
        const owner = fnOwner(role);
        if (owner) owners.add(owner);
      }
    }
  }
  return [...owners].sort();
}

function functionByName(fnId: FnId): { Properties?: any } {
  const match = resourcesOfType('AWS::Lambda::Function').find(
    ([, r]) => r.Properties?.FunctionName === `TestApi-${fnId}`
  );
  expect(match, `no Lambda named TestApi-${fnId}`).toBeDefined();
  return match![1];
}

describe('gateway route table', () => {
  it('synthesizes exactly the manifest routeKeys', () => {
    const synthesized = resourcesOfType('AWS::ApiGatewayV2::Route')
      .map(([, r]) => r.Properties?.RouteKey as string)
      .sort();
    const expected = ROUTES.map((r) => r.routeKey).sort();
    expect(synthesized).toEqual(expected);
  });

  it('applies the Cognito authorizer to exactly the jwt routes', () => {
    for (const [, r] of resourcesOfType('AWS::ApiGatewayV2::Route')) {
      const routeKey = r.Properties?.RouteKey as string;
      const manifest = ROUTES.find((m) => m.routeKey === routeKey)!;
      const authType = r.Properties?.AuthorizationType ?? 'NONE';
      expect(authType, routeKey).toBe(manifest.auth === 'jwt' ? 'JWT' : 'NONE');
    }
  });

  it('has a single Cognito authorizer', () => {
    expect(resourcesOfType('AWS::ApiGatewayV2::Authorizer')).toHaveLength(1);
  });
});

describe('resource budget (CloudFormation hard limit is 500)', () => {
  it('reuses one integration and one permission per function', () => {
    // A regression to per-route integrations (or losing
    // scopePermissionToRoute: false) triples the cost of every future route.
    expect(resourcesOfType('AWS::ApiGatewayV2::Integration')).toHaveLength(FN_IDS.length);
    expect(resourcesOfType('AWS::Lambda::Permission')).toHaveLength(FN_IDS.length);
  });

  it('creates one Lambda per manifest function (plus the LogRetention provider)', () => {
    expect(resourcesOfType('AWS::Lambda::Function')).toHaveLength(FN_IDS.length + 1);
    expect(resourcesOfType('Custom::LogRetention')).toHaveLength(FN_IDS.length);
  });

  it('stays comfortably under the 500-resource limit', () => {
    const count = Object.keys(resources).length;
    expect(count).toBeLessThan(350);
  });
});

describe('privileged IAM stays on its dedicated functions', () => {
  it('cognito-idp:AdminDeleteUser → UserDelete only', () => {
    expect(fnsWithAction('cognito-idp:AdminDeleteUser')).toEqual(['UserDelete']);
  });

  it('states:StartExecution → ResearchTriggers only', () => {
    expect(fnsWithAction('states:StartExecution')).toEqual(['ResearchTriggers']);
  });

  it('SFN history + deep-research log reads → ResearchRunsDetails only', () => {
    expect(fnsWithAction('states:GetExecutionHistory')).toEqual(['ResearchRunsDetails']);
    expect(fnsWithAction('states:DescribeExecution')).toEqual(['ResearchRunsDetails']);
    expect(fnsWithAction('logs:FilterLogEvents')).toEqual(['ResearchRunsDetails']);
  });

  it('ses:SendEmail → exactly the three email-sending functions', () => {
    expect(fnsWithAction('ses:SendEmail')).toEqual(['PaddleWebhook', 'UserDelete', 'Workspaces']);
  });
});

describe('per-function configuration', () => {
  it('marker env vars land on the right functions', () => {
    const envOf = (fnId: FnId): Record<string, unknown> =>
      functionByName(fnId).Properties?.Environment?.Variables ?? {};

    expect(envOf('AuthSignup')).toHaveProperty('SIGNUP_ENABLED');
    expect(envOf('Subscriptions')).toHaveProperty('PADDLE_PRICE_SCOUT');
    expect(envOf('Subscriptions')).toHaveProperty('PADDLE_PRICE_STRATEGIST');
    expect(envOf('Subscriptions')).toHaveProperty('PADDLE_PRICE_COMMAND');
    expect(envOf('Admin')).toHaveProperty('ADMIN_EMAILS');
    expect(envOf('ResearchTriggers')).toHaveProperty('RESEARCH_PIPELINE_ARN');
    expect(envOf('ResearchRunsDetails')).toHaveProperty('DEEP_RESEARCH_LAMBDA_NAME');

    // ...and nowhere else (spot-check the sensitive ones).
    expect(envOf('Users')).not.toHaveProperty('SIGNUP_ENABLED');
    expect(envOf('Brand')).not.toHaveProperty('RESEARCH_PIPELINE_ARN');
  });

  it('every function carries the shared env', () => {
    for (const fnId of FN_IDS) {
      const vars = functionByName(fnId).Properties?.Environment?.Variables ?? {};
      for (const key of ['TABLE_NAME', 'BUCKET_NAME', 'USER_POOL_ID', 'SECRETS_ARN', 'FRONTEND_URL']) {
        expect(vars, `${fnId} missing ${key}`).toHaveProperty(key);
      }
    }
  });

  it('only Pdf gets the 1024 MB / 60 s profile', () => {
    for (const fnId of FN_IDS) {
      const props = functionByName(fnId).Properties;
      if (fnId === 'Pdf') {
        expect(props?.MemorySize).toBe(1024);
        expect(props?.Timeout).toBe(60);
      } else {
        expect(props?.MemorySize, fnId).toBe(256);
        expect(props?.Timeout, fnId).toBe(30);
      }
    }
  });
});
