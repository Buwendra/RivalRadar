import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Auth from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as apigatewayv2Int from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  snapshotBucket: s3.Bucket;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  researchStateMachine: sfn.StateMachine;
}

export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { table, snapshotBucket, userPool, userPoolClient, researchStateMachine } = props;

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
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
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

    // Helper to create Lambda + route
    const addRoute = (
      routeId: string,
      method: apigatewayv2.HttpMethod,
      routePath: string,
      entry: string,
      auth: boolean = true,
      extraEnv?: Record<string, string>
    ) => {
      const fn = new nodejs.NodejsFunction(this, routeId, {
        ...lambdaDefaults,
        entry: path.join(__dirname, '..', '..', 'src', 'functions', entry),
        functionName: `${this.stackName}-${routeId}`,
        environment: { ...sharedEnv, ...extraEnv },
      });

      table.grantReadWriteData(fn);
      snapshotBucket.grantReadWrite(fn);
      apiSecrets.grantRead(fn);

      this.httpApi.addRoutes({
        path: routePath,
        methods: [method],
        integration: new apigatewayv2Int.HttpLambdaIntegration(`${routeId}-Int`, fn),
        authorizer: auth ? authorizer : undefined,
      });

      return fn;
    };

    // ─── Auth Routes (public) ───
    addRoute('AuthSignup', apigatewayv2.HttpMethod.POST, '/auth/signup', 'api/auth/signup.ts', false);
    addRoute('AuthSignin', apigatewayv2.HttpMethod.POST, '/auth/signin', 'api/auth/signin.ts', false);

    const pipelineEnv = {
      RESEARCH_PIPELINE_ARN: researchStateMachine.stateMachineArn,
    };

    // ─── User Routes ───
    addRoute('UserProfile', apigatewayv2.HttpMethod.GET, '/users/me', 'api/users/profile.ts');
    addRoute('UserUpdate', apigatewayv2.HttpMethod.PUT, '/users/me', 'api/users/profile.ts');
    const onboardFn = addRoute('UserOnboard', apigatewayv2.HttpMethod.POST, '/users/onboard', 'api/users/onboard.ts', true, pipelineEnv);
    researchStateMachine.grantStartExecution(onboardFn);

    // ─── Competitor Routes ───
    addRoute('CompetitorList', apigatewayv2.HttpMethod.GET, '/competitors', 'api/competitors/list.ts');
    addRoute('CompetitorCreate', apigatewayv2.HttpMethod.POST, '/competitors', 'api/competitors/create.ts');
    addRoute('CompetitorGet', apigatewayv2.HttpMethod.GET, '/competitors/{id}', 'api/competitors/get.ts');
    addRoute('CompetitorDelete', apigatewayv2.HttpMethod.DELETE, '/competitors/{id}', 'api/competitors/delete.ts');
    const researchFn = addRoute('CompetitorResearch', apigatewayv2.HttpMethod.POST, '/competitors/{id}/research', 'api/competitors/research.ts', true, pipelineEnv);
    researchStateMachine.grantStartExecution(researchFn);

    // ─── Changes Routes ───
    addRoute('ChangesList', apigatewayv2.HttpMethod.GET, '/changes', 'api/changes/list.ts');
    addRoute('ChangesGet', apigatewayv2.HttpMethod.GET, '/changes/{id}', 'api/changes/get.ts');
    addRoute('ChangesFeedback', apigatewayv2.HttpMethod.POST, '/changes/{id}/feedback', 'api/changes/feedback.ts');

    // ─── Subscription Routes ───
    addRoute('SubCurrent', apigatewayv2.HttpMethod.GET, '/subscriptions/me', 'api/subscriptions/current.ts');
    addRoute('SubCheckout', apigatewayv2.HttpMethod.POST, '/subscriptions/checkout', 'api/subscriptions/checkout.ts', true, {
      PADDLE_PRICE_SCOUT: process.env.PADDLE_PRICE_SCOUT ?? '',
      PADDLE_PRICE_STRATEGIST: process.env.PADDLE_PRICE_STRATEGIST ?? '',
      PADDLE_PRICE_COMMAND: process.env.PADDLE_PRICE_COMMAND ?? '',
    });
    addRoute('SubPortal', apigatewayv2.HttpMethod.POST, '/subscriptions/portal', 'api/subscriptions/portal.ts');

    // ─── Webhook Routes (public, verified by signature) ───
    addRoute('PaddleWebhook', apigatewayv2.HttpMethod.POST, '/webhooks/paddle', 'api/webhooks/paddle.ts', false);

    // ─── Outputs ───
    new cdk.CfnOutput(this, 'ApiUrl', { value: this.httpApi.apiEndpoint });
  }
}
