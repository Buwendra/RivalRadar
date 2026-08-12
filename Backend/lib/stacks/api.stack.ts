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
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
// Relative import on purpose: cdk synth runs under plain ts-node, which does
// not resolve the @functions/* tsconfig alias. The manifest is a zero-import
// leaf module (pure data), so this pulls no runtime code into synth.
import {
  FNS,
  ROUTES,
  FnId,
  FnDef,
  EnvMarker,
  GrantMarker,
  HttpMethodStr,
} from '../../src/functions/route-manifest';

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

// pdfkit ships AFM font metrics as .afm files — esbuild treats them as binary
// assets and won't bundle them automatically; copying preserves the relative
// path PDFKit expects. Applied to any FnDef with `pdfFonts: true` (the Pdf
// function). Missing this hook fails LAZILY: the function cold-starts fine
// and only throws "Cannot find module ... data/Helvetica.afm" when a PDF is
// actually rendered — which is why Phase 8 verification generates one.
const pdfFontCommandHooks = {
  beforeBundling: () => [],
  beforeInstall: () => [],
  afterBundling(inputDir: string, outputDir: string) {
    return [
      `node -e "const fs=require('fs'),path=require('path');const src=path.join('${inputDir.replace(/\\/g, '/')}','node_modules/pdfkit/js/data');const dst=path.join('${outputDir.replace(/\\/g, '/')}','data');if(fs.existsSync(src)){fs.mkdirSync(dst,{recursive:true});for(const f of fs.readdirSync(src))fs.copyFileSync(path.join(src,f),path.join(dst,f));}"`,
    ];
  },
};

export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { table, snapshotBucket, userPool, userPoolClient, researchStateMachine, deepResearchFn } = props;

    // Secrets for external APIs. Path literal must match API_SECRETS_PATH in
    // src/shared/services/secrets.ts (stacks can't import runtime code).
    const apiSecrets = secretsmanager.Secret.fromSecretNameV2(
      this, 'ApiSecrets', 'kironyx/api-keys'
    );

    // Origins allowed to call the API. ALLOWED_ORIGINS is comma-separated
    // (kironyx.com + www + the amplifyapp URL); FRONTEND_URL stays the
    // single-origin fallback and the canonical origin for email links.
    // allowCredentials: true forbids '*', so this must be a concrete list.
    // Empty-after-parse falls back too (a `??` chain alone would let a blank
    // `ALLOWED_ORIGINS=` line in .env deploy an EMPTY allow-list and brick
    // CORS for every origin — synth would not warn).
    // CORS twins: this gateway list and corsHeaders() in
    // src/shared/middleware/handler.ts must not drift apart.
    const parsedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const allowedOrigins = parsedOrigins.length
      ? parsedOrigins
      : [process.env.FRONTEND_URL ?? 'http://localhost:3000'];

    // ─── HTTP API ───
    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `${this.stackName}-Api`,
      corsPreflight: {
        allowOrigins: allowedOrigins,
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
      ALLOWED_ORIGINS: allowedOrigins.join(','),
    };

    const lambdaDefaults: nodejs.NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: sharedEnv,
      // 90-day retention. The `logRetention` prop (one custom resource per
      // function + a singleton provider) beats explicit LogGroups here: it
      // keeps resource count down and preserves continuity with any
      // pre-existing log groups on redeploys.
      logRetention: logs.RetentionDays.THREE_MONTHS,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    };

    // ─── Domain functions + routes (driven by src/functions/route-manifest.ts) ───
    //
    // 20 domain-grouped Lambdas instead of one per route: CloudFormation caps
    // a stack at 500 resources (hard limit — the per-route layout synthesized
    // 588 and could not deploy). Each function is a thin router dispatching on
    // the exact `event.routeKey` (src/functions/routers/), and the manifest is
    // the single source of truth for route → function → auth → grants.
    // Adding a route costs ONE CloudFormation resource (the Route).
    //
    // Two tests keep this honest: routers/router-manifest.test.ts (dispatch
    // tables match the manifest) and lib/stacks/api.stack.test.ts (the
    // synthesized template matches the manifest — routes, auth, counts, and
    // that special grants land only on their intended roles).

    // EnvMarker → concrete environment variables. Lazy thunks so construct
    // references (state machine ARN, fn name) resolve at call time.
    const markerEnv: Record<EnvMarker, () => Record<string, string>> = {
      // Defaults to off (pre-launch). The handler 403s with SIGNUP_DISABLED
      // unless the env var is exactly 'true'. Cognito's selfSignUpEnabled:
      // false (Auth stack) is the hard backstop.
      signupFlag: () => ({ SIGNUP_ENABLED: process.env.SIGNUP_ENABLED ?? 'false' }),
      paddlePrices: () => ({
        PADDLE_PRICE_SCOUT: process.env.PADDLE_PRICE_SCOUT ?? '',
        PADDLE_PRICE_STRATEGIST: process.env.PADDLE_PRICE_STRATEGIST ?? '',
        PADDLE_PRICE_COMMAND: process.env.PADDLE_PRICE_COMMAND ?? '',
      }),
      adminEmails: () => ({ ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? '' }),
      researchPipelineArn: () => ({ RESEARCH_PIPELINE_ARN: researchStateMachine.stateMachineArn }),
      deepResearchLambdaName: () => ({ DEEP_RESEARCH_LAMBDA_NAME: deepResearchFn.functionName }),
    };

    // GrantMarker → concrete IAM. Every function separately gets the baseline
    // (table RW + bucket RW + secrets read) below; these are the deliberate
    // exceptions, kept on dedicated functions by the manifest's grouping.
    const applyGrant: Record<GrantMarker, (fn: nodejs.NodejsFunction) => void> = {
      startResearchExecution: (fn) => researchStateMachine.grantStartExecution(fn),
      // GDPR Art. 17 / CCPA §1798.105 — account deletion needs to invalidate
      // the Cognito identity.
      adminDeleteUser: (fn) =>
        fn.addToRolePolicy(
          new cdk.aws_iam.PolicyStatement({
            actions: ['cognito-idp:AdminDeleteUser'],
            resources: [userPool.userPoolArn],
          })
        ),
      // Phase 22 lazy "Technical details" — SFN execution history + a
      // CloudWatch tail of the DeepResearch Lambda's log group.
      sfnReadExecution: (fn) => {
        fn.addToRolePolicy(
          new cdk.aws_iam.PolicyStatement({
            actions: ['states:GetExecutionHistory', 'states:DescribeExecution'],
            resources: [
              researchStateMachine.stateMachineArn,
              `${researchStateMachine.stateMachineArn}:*`,
              `arn:aws:states:${this.region}:${this.account}:execution:${researchStateMachine.stateMachineName}:*`,
            ],
          })
        );
        fn.addToRolePolicy(
          new cdk.aws_iam.PolicyStatement({
            actions: ['logs:FilterLogEvents'],
            resources: [
              `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${deepResearchFn.functionName}:*`,
            ],
          })
        );
      },
      // Inline email sends (invites, deletion certificate, Paddle lifecycle)
      // — mirrors the pipeline email Lambdas' grant.
      sesSend: (fn) =>
        fn.addToRolePolicy(
          new cdk.aws_iam.PolicyStatement({
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'],
          })
        ),
    };

    const integrations = {} as Record<FnId, apigatewayv2Int.HttpLambdaIntegration>;

    for (const [fnId, def] of Object.entries(FNS) as [FnId, FnDef][]) {
      const environment = { ...sharedEnv };
      for (const marker of def.env ?? []) Object.assign(environment, markerEnv[marker]());

      const fn = new nodejs.NodejsFunction(this, fnId, {
        ...lambdaDefaults,
        entry: path.join(__dirname, '..', '..', 'src', 'functions', def.entry),
        functionName: `${this.stackName}-${fnId}`,
        memorySize: def.memoryMb ?? lambdaDefaults.memorySize,
        timeout: def.timeoutSec ? cdk.Duration.seconds(def.timeoutSec) : lambdaDefaults.timeout,
        environment,
        bundling: def.pdfFonts
          ? { ...lambdaDefaults.bundling, commandHooks: pdfFontCommandHooks }
          : lambdaDefaults.bundling,
      });

      table.grantReadWriteData(fn);
      snapshotBucket.grantReadWrite(fn);
      apiSecrets.grantRead(fn);
      for (const marker of def.grants ?? []) applyGrant[marker](fn);

      // ONE integration instance per function, reused by every route below.
      // scopePermissionToRoute: false gives one api-scoped Lambda::Permission
      // per function instead of one per route — together these keep the
      // resource cost of a new route at exactly 1 (the Route itself).
      // CDK parents the Integration under the FIRST route that binds it, so
      // reordering a function's manifest rows replaces the integration on the
      // next deploy (stateless, harmless, but noisy — append new routes at
      // the end of their group).
      integrations[fnId] = new apigatewayv2Int.HttpLambdaIntegration(`${fnId}-Int`, fn, {
        scopePermissionToRoute: false,
      });
    }

    for (const route of ROUTES) {
      const [method, routePath] = route.routeKey.split(' ') as [HttpMethodStr, string];
      this.httpApi.addRoutes({
        path: routePath,
        methods: [apigatewayv2.HttpMethod[method]],
        integration: integrations[route.fn],
        authorizer: route.auth === 'jwt' ? authorizer : undefined,
      });
    }

    // ─── Phase 9: API Gateway Throttling ───
    // Pre-launch limit (20 req/s, 40 burst) — deliberately tight while the
    // app is domain-hosted but not publicly launched; a handful of real
    // users won't come near it, and it blunts floods/runaway client loops.
    // Loosen when opening to the public.
    //
    // NOTE: per-route stricter throttling (e.g. 5 req/s on /auth/signin) is
    // NOT possible on API Gateway HTTP API v2 — the `throttlingBurstLimit` /
    // `throttlingRateLimit` properties on `routeSettings` are REST API v1
    // only. AWS CFN rejects them on v2 with a Property validation failure.
    // Real per-route throttling requires either (a) migrating to REST API
    // v1, or (b) WAFv2 rate-based rules with URI-path scope statements,
    // which need the API fronted by CloudFront. Both are deferred to the
    // Go Live phase. Cognito provides default lockout on the signin path
    // as a partial mitigation today. The per-FUNCTION emergency lever is
    // reserved concurrency = 0 (see INCIDENT_RUNBOOK) — with domain-grouped
    // functions it throttles every route of that function, which is why the
    // kill-switch-critical routes (AuthSignup, AuthRefresh, PaddleWebhook,
    // UserDelete, ResearchRunsDetails) live in solo functions.
    const defaultStage = this.httpApi.defaultStage!.node.defaultChild as apigatewayv2.CfnStage;
    defaultStage.defaultRouteSettings = {
      throttlingBurstLimit: 40,
      throttlingRateLimit: 20,
    };

    // ─── Outputs ───
    new cdk.CfnOutput(this, 'ApiUrl', { value: this.httpApi.apiEndpoint });
  }
}
