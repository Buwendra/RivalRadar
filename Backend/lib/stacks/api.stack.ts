import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Auth from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import * as path from 'path';
import { SharedRouteProps } from './api/route-factory';
import { CoreRoutesStack } from './api/core.nested-stack';
import { CompetitorRoutesStack } from './api/competitors.nested-stack';
import { AnalyticsExportsRoutesStack } from './api/analytics-exports.nested-stack';
import { IntegrationRoutesStack } from './api/integrations.nested-stack';

interface ApiStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  snapshotBucket: s3.Bucket;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  researchStateMachine: sfn.StateMachine;
  /** DeepResearch Lambda — Phase 22 needs its log-group ARN for the
   *  research-run details endpoint. */
  deepResearchFn: lambda.Function;
}

/**
 * Owns the HTTP API, the Cognito authorizer, default-stage throttling, and the
 * shared Lambda config — then delegates the ~80 routes to four route-group
 * NestedStacks (Core, Competitor, AnalyticsExports, Integration).
 *
 * Why split: a single stack hit CloudFormation's hard 500-resource limit
 * (~6 resources per route). Each NestedStack gets its own 500-resource budget;
 * this parent counts only one `AWS::CloudFormation::Stack` per group, so it
 * stays tiny (~HttpApi + Stage + Authorizer + 4 nested-stack refs).
 *
 * Load-bearing detail: the route groups receive the concrete `httpApi`
 * INSTANCE (not an imported `IHttpApi`). `HttpRoute` binds the authorizer with
 * `scope = httpApi` when `httpApi instanceof Construct`, so the single
 * `CfnAuthorizer` is created under the HttpApi here in the parent and every
 * group shares it by `authorizerId` token — no cross-nested-stack reference.
 */
export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { table, snapshotBucket, userPool, userPoolClient, researchStateMachine, deepResearchFn } = props;

    // Secrets for external APIs
    const apiSecrets = secretsmanager.Secret.fromSecretNameV2(
      this, 'ApiSecrets', 'rivalscan/api-keys'
    );

    // ─── HTTP API ───
    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `${this.stackName}-Api`,
      corsPreflight: {
        allowOrigins: [process.env.FRONTEND_URL ?? 'http://localhost:3000'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Workspace-Id', 'X-Api-Key'],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(1),
      },
    });

    // ─── Cognito Authorizer ───
    const authorizer = new apigatewayv2Auth.HttpUserPoolAuthorizer(
      'CognitoAuthorizer',
      userPool,
      { userPoolClients: [userPoolClient] }
    );

    // ─── Shared Lambda Environment ───
    const sharedEnv = {
      TABLE_NAME: table.tableName,
      BUCKET_NAME: snapshotBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      SECRETS_ARN: apiSecrets.secretArn,
      FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    };

    const lambdaDefaults: nodejs.NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: sharedEnv,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    };

    // Inputs every route-group nested stack shares (built once, passed down).
    const shared: SharedRouteProps = {
      httpApi: this.httpApi,
      authorizer,
      table,
      snapshotBucket,
      apiSecrets,
      sharedEnv,
      lambdaDefaults,
      entryRoot: path.join(__dirname, '..', '..', 'src', 'functions'),
    };

    // ─── Route groups (each is its own CloudFormation stack) ───
    new CoreRoutesStack(this, 'CoreRoutes', { ...shared, researchStateMachine, userPool });
    new CompetitorRoutesStack(this, 'CompetitorRoutes', { ...shared, researchStateMachine, deepResearchFn });
    new AnalyticsExportsRoutesStack(this, 'AnalyticsExportsRoutes', { ...shared });
    new IntegrationRoutesStack(this, 'IntegrationRoutes', { ...shared });

    // ─── Phase 9: API Gateway Throttling ───
    // Default loose limit (100 req/s, 200 burst) catches runaway client loops
    // without affecting normal usage.
    //
    // NOTE: per-route stricter throttling (e.g. 5 req/s on /auth/signin) is
    // NOT possible on API Gateway HTTP API v2 — the `throttlingBurstLimit` /
    // `throttlingRateLimit` properties on `routeSettings` are REST API v1
    // only. AWS CFN rejects them on v2 with a Property validation failure.
    // Real per-route throttling requires either (a) migrating to REST API
    // v1, or (b) WAFv2 rate-based rules with URI-path scope statements,
    // which need the API fronted by CloudFront. Both are deferred to the
    // Go Live phase. Cognito provides default lockout on the signin path
    // as a partial mitigation today.
    const defaultStage = this.httpApi.defaultStage!.node.defaultChild as apigatewayv2.CfnStage;
    defaultStage.defaultRouteSettings = {
      throttlingBurstLimit: 200,
      throttlingRateLimit: 100,
    };

    // ─── Outputs ───
    new cdk.CfnOutput(this, 'ApiUrl', { value: this.httpApi.apiEndpoint });
  }
}
