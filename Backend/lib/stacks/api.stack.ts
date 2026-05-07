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
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
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
    addRoute('AuthResendVerification', apigatewayv2.HttpMethod.POST, '/auth/resend-verification', 'api/auth/resend-verification.ts', false);

    const pipelineEnv = {
      RESEARCH_PIPELINE_ARN: researchStateMachine.stateMachineArn,
    };

    // ─── User Routes ───
    addRoute('UserProfile', apigatewayv2.HttpMethod.GET, '/users/me', 'api/users/profile.ts');
    addRoute('UserUpdate', apigatewayv2.HttpMethod.PUT, '/users/me', 'api/users/profile.ts');
    // Phase 8a — once-per-session login ping for the retention-nudge cron
    addRoute('UserPing', apigatewayv2.HttpMethod.POST, '/users/me/ping', 'api/users/ping.ts');
    // Phase 9a — GDPR Art. 18 self-suspend + re-consent
    addRoute('UserSuspend', apigatewayv2.HttpMethod.POST, '/users/me/suspend', 'api/users/suspend.ts');
    addRoute('UserResume', apigatewayv2.HttpMethod.POST, '/users/me/resume', 'api/users/suspend.ts');
    addRoute('UserAcceptTos', apigatewayv2.HttpMethod.POST, '/users/me/accept-tos', 'api/users/accept-tos.ts');
    const onboardFn = addRoute('UserOnboard', apigatewayv2.HttpMethod.POST, '/users/onboard', 'api/users/onboard.ts', true, pipelineEnv);
    researchStateMachine.grantStartExecution(onboardFn);

    // ─── Workspaces (Phase 4a) ───
    addRoute('WorkspacesList', apigatewayv2.HttpMethod.GET, '/workspaces', 'api/workspaces/list.ts');
    addRoute('WorkspaceMembersList', apigatewayv2.HttpMethod.GET, '/workspaces/current/members', 'api/workspaces/members.ts');
    addRoute('WorkspaceMemberRemove', apigatewayv2.HttpMethod.DELETE, '/workspaces/current/members/{userId}', 'api/workspaces/members.ts');
    // Phase 14 — role change (member ↔ admin), owner-only
    addRoute('WorkspaceMemberRoleChange', apigatewayv2.HttpMethod.PATCH, '/workspaces/current/members/{userId}', 'api/workspaces/members.ts');
    addRoute('WorkspaceInvite', apigatewayv2.HttpMethod.POST, '/workspaces/current/invitations', 'api/workspaces/invite.ts');
    addRoute('InvitationAccept', apigatewayv2.HttpMethod.POST, '/invitations/{token}/accept', 'api/workspaces/accept-invitation.ts');

    // ─── Workspace governance (Phase 4b) ───
    addRoute('WorkspaceUpdate', apigatewayv2.HttpMethod.PATCH, '/workspaces/current', 'api/workspaces/update.ts');
    addRoute('WorkspaceDelete', apigatewayv2.HttpMethod.DELETE, '/workspaces/current', 'api/workspaces/delete.ts');
    addRoute('WorkspaceAudit', apigatewayv2.HttpMethod.GET, '/workspaces/current/audit', 'api/workspaces/audit.ts');

    // ─── Ownership transfer (Phase 4c) ───
    addRoute('WorkspaceTransfer', apigatewayv2.HttpMethod.POST, '/workspaces/current/transfer-ownership', 'api/workspaces/transfer-ownership.ts');

    // ─── API Keys management (Phase 11) ───
    addRoute('ApiKeysCreate', apigatewayv2.HttpMethod.POST, '/workspaces/current/api-keys', 'api/api-keys/create.ts');
    addRoute('ApiKeysList', apigatewayv2.HttpMethod.GET, '/workspaces/current/api-keys', 'api/api-keys/list.ts');
    addRoute('ApiKeysDelete', apigatewayv2.HttpMethod.DELETE, '/workspaces/current/api-keys/{id}', 'api/api-keys/delete.ts');

    // ─── Public read API (Phase 11) — auth via X-API-Key, NOT Cognito ───
    addRoute('ApiV1CompetitorsList', apigatewayv2.HttpMethod.GET, '/v1/competitors', 'api/v1/competitors.ts', false);
    addRoute('ApiV1ChangesList', apigatewayv2.HttpMethod.GET, '/v1/changes', 'api/v1/changes.ts', false);
    addRoute('ApiV1RecommendationsList', apigatewayv2.HttpMethod.GET, '/v1/recommendations', 'api/v1/recommendations.ts', false);

    // ─── Public write API (Phase 13) — write-scope keys only ───
    addRoute('ApiV1CompetitorsCreate', apigatewayv2.HttpMethod.POST, '/v1/competitors', 'api/v1/competitors-create.ts', false);
    addRoute('ApiV1CompetitorsSnooze', apigatewayv2.HttpMethod.PATCH, '/v1/competitors/{id}/snooze', 'api/v1/competitors-snooze.ts', false);
    addRoute('ApiV1RecommendationsUpdate', apigatewayv2.HttpMethod.PATCH, '/v1/recommendations/{id}', 'api/v1/recommendations-update.ts', false);

    // GDPR Art. 15+20 / CCPA §1798.110 — data export
    addRoute('UserExport', apigatewayv2.HttpMethod.GET, '/users/me/export', 'api/users/export.ts');

    // GDPR Art. 17 / CCPA §1798.105 — account deletion (right to erasure).
    // Lambda needs cognito:AdminDeleteUser to invalidate the auth identity.
    const userDeleteFn = addRoute(
      'UserDelete',
      apigatewayv2.HttpMethod.DELETE,
      '/users/me',
      'api/users/delete.ts'
    );
    userDeleteFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['cognito-idp:AdminDeleteUser'],
        resources: [userPool.userPoolArn],
      })
    );

    // ─── Competitor Routes ───
    addRoute('CompetitorList', apigatewayv2.HttpMethod.GET, '/competitors', 'api/competitors/list.ts');
    addRoute('CompetitorCreate', apigatewayv2.HttpMethod.POST, '/competitors', 'api/competitors/create.ts');
    // Phase 12 — CSV bulk import
    addRoute('CompetitorBulkImport', apigatewayv2.HttpMethod.POST, '/competitors/bulk-import', 'api/competitors/bulk-import.ts');
    addRoute('CompetitorGet', apigatewayv2.HttpMethod.GET, '/competitors/{id}', 'api/competitors/get.ts');
    addRoute('CompetitorDelete', apigatewayv2.HttpMethod.DELETE, '/competitors/{id}', 'api/competitors/delete.ts');
    const researchFn = addRoute('CompetitorResearch', apigatewayv2.HttpMethod.POST, '/competitors/{id}/research', 'api/competitors/research.ts', true, pipelineEnv);
    researchStateMachine.grantStartExecution(researchFn);
    // Phase 7a — snooze toggle
    addRoute('CompetitorSnooze', apigatewayv2.HttpMethod.PATCH, '/competitors/{id}/snooze', 'api/competitors/snooze.ts');

    // ─── Changes Routes ───
    addRoute('ChangesList', apigatewayv2.HttpMethod.GET, '/changes', 'api/changes/list.ts');
    addRoute('ChangesGet', apigatewayv2.HttpMethod.GET, '/changes/{id}', 'api/changes/get.ts');
    addRoute('ChangesFeedback', apigatewayv2.HttpMethod.POST, '/changes/{id}/feedback', 'api/changes/feedback.ts');
    // Phase 7a — change notes (single handler dispatches GET vs POST internally)
    addRoute('ChangesNotesList', apigatewayv2.HttpMethod.GET, '/changes/{id}/notes', 'api/changes/notes.ts');
    addRoute('ChangesNotesCreate', apigatewayv2.HttpMethod.POST, '/changes/{id}/notes', 'api/changes/notes.ts');

    // ─── Recommendations Routes (Phase 2) ───
    addRoute('RecommendationsList', apigatewayv2.HttpMethod.GET, '/recommendations', 'api/recommendations/list.ts');
    addRoute('RecommendationsUpdate', apigatewayv2.HttpMethod.PATCH, '/recommendations/{id}', 'api/recommendations/update-status.ts');

    // ─── Notifications (Phase 18) — caller-scoped in-app inbox ───
    addRoute('NotificationsList', apigatewayv2.HttpMethod.GET, '/notifications', 'api/notifications/list.ts');
    addRoute('NotificationsMarkRead', apigatewayv2.HttpMethod.PATCH, '/notifications/{id}/read', 'api/notifications/mark-read.ts');
    addRoute('NotificationsMarkAllRead', apigatewayv2.HttpMethod.POST, '/notifications/mark-all-read', 'api/notifications/mark-all-read.ts');

    // ─── Saved Views (Phase 7b) ───
    addRoute('SavedViewsList', apigatewayv2.HttpMethod.GET, '/saved-views', 'api/saved-views/list.ts');
    addRoute('SavedViewsCreate', apigatewayv2.HttpMethod.POST, '/saved-views', 'api/saved-views/create.ts');
    addRoute('SavedViewsUpdate', apigatewayv2.HttpMethod.PATCH, '/saved-views/{id}', 'api/saved-views/update.ts');
    addRoute('SavedViewsDelete', apigatewayv2.HttpMethod.DELETE, '/saved-views/{id}', 'api/saved-views/delete.ts');
    // Phase 15 — saved-view email subscriptions (per-caller, weekly cadence)
    addRoute('SavedViewsSubscribe', apigatewayv2.HttpMethod.POST, '/saved-views/{id}/subscribe', 'api/saved-views/subscribe.ts');
    addRoute('SavedViewsUnsubscribe', apigatewayv2.HttpMethod.DELETE, '/saved-views/{id}/subscribe', 'api/saved-views/unsubscribe.ts');

    // ─── Search (Phase 7b) ───
    addRoute('Search', apigatewayv2.HttpMethod.GET, '/search', 'api/search/search.ts');

    // ─── Onboarding Routes (Phase 5) ───
    addRoute('OnboardingSuggestCompetitors', apigatewayv2.HttpMethod.POST, '/onboarding/suggest-competitors', 'api/onboarding/suggest-competitors.ts');

    // ─── Exports Routes (Phase 6a + 6b) ───
    addRoute('ExportsCsv', apigatewayv2.HttpMethod.POST, '/exports/csv', 'api/exports/csv.ts');

    // PDF export needs more memory + a longer timeout than the default 256 MB / 30s
    // because PDFKit + S3 upload can take 1–3s and the bundled PDFKit binary
    // benefits from more RAM during cold start. Created outside `addRoute()` so
    // we can override the lambdaDefaults; otherwise mirrors the same grants
    // (table RW, bucket RW, secrets read) and route registration.
    const exportsPdfFn = new nodejs.NodejsFunction(this, 'ExportsPdf', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '..', '..', 'src', 'functions', 'api/exports/pdf.ts'),
      functionName: `${this.stackName}-ExportsPdf`,
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      // pdfkit ships AFM font metrics as .afm files — keep them in the bundle.
      bundling: {
        ...lambdaDefaults.bundling,
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling(inputDir: string, outputDir: string) {
            // Copy the bundled .afm font files PDFKit reads at runtime.
            // esbuild treats these as binary assets and won't bundle them
            // automatically; copying preserves the relative path PDFKit expects.
            return [
              `node -e "const fs=require('fs'),path=require('path');const src=path.join('${inputDir.replace(/\\/g, '/')}','node_modules/pdfkit/js/data');const dst=path.join('${outputDir.replace(/\\/g, '/')}','data');if(fs.existsSync(src)){fs.mkdirSync(dst,{recursive:true});for(const f of fs.readdirSync(src))fs.copyFileSync(path.join(src,f),path.join(dst,f));}"`,
            ];
          },
        },
      },
    });
    table.grantReadWriteData(exportsPdfFn);
    snapshotBucket.grantReadWrite(exportsPdfFn);
    apiSecrets.grantRead(exportsPdfFn);
    this.httpApi.addRoutes({
      path: '/exports/pdf',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Int.HttpLambdaIntegration('ExportsPdf-Int', exportsPdfFn),
      authorizer,
    });

    // ─── Integrations Routes (Phase 3) ───
    addRoute('IntegrationsList', apigatewayv2.HttpMethod.GET, '/integrations', 'api/integrations/list.ts');
    addRoute('IntegrationsSet', apigatewayv2.HttpMethod.POST, '/integrations', 'api/integrations/set.ts');
    addRoute('IntegrationsTest', apigatewayv2.HttpMethod.POST, '/integrations/{provider}/test', 'api/integrations/test.ts');
    addRoute('IntegrationsDelete', apigatewayv2.HttpMethod.DELETE, '/integrations/{provider}', 'api/integrations/delete.ts');

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

    // ─── Cancellation Feedback (Phase 8b — public, token-validated) ───
    addRoute(
      'CancellationFeedbackSubmit',
      apigatewayv2.HttpMethod.POST,
      '/cancellation-feedback/{token}',
      'api/cancellation/submit.ts',
      false
    );

    // ─── Admin Business Snapshot (Phase 8b — owner-only via ADMIN_EMAILS allowlist) ───
    addRoute(
      'AdminBusiness',
      apigatewayv2.HttpMethod.GET,
      '/admin/business',
      'api/admin/business.ts',
      true,
      { ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? '' }
    );

    // ─── Phase 9a: API Gateway Throttling ───
    // Default loose limit (100 req/s, 200 burst) catches runaway client loops
    // without affecting normal usage. Per-route tight limits on auth endpoints
    // (5 req/s, 10 burst) blunt credential-stuffing + signup-spam attacks.
    // Phase 9b will add full AWS WAF rate-based rules; this is the API-level
    // first line of defense.
    const defaultStage = this.httpApi.defaultStage!.node.defaultChild as apigatewayv2.CfnStage;
    defaultStage.defaultRouteSettings = {
      throttlingBurstLimit: 200,
      throttlingRateLimit: 100,
    };
    defaultStage.routeSettings = [
      { routeKey: 'POST /auth/signup', throttlingBurstLimit: 10, throttlingRateLimit: 5 },
      { routeKey: 'POST /auth/signin', throttlingBurstLimit: 10, throttlingRateLimit: 5 },
      {
        routeKey: 'POST /auth/resend-verification',
        throttlingBurstLimit: 5,
        throttlingRateLimit: 2,
      },
    ];

    // ─── Phase 9a: AWS WAF v2 ───
    // Three managed rule sets covering OWASP Top 10 + known-bad inputs +
    // anonymous IP / IP reputation. Plus a custom rate-based rule capping
    // any single IP at 2000 requests / 5 min (≈ 400 req/min). Action defaults
    // to BLOCK except for managed rules where we trust AWS's defaults.
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: `${this.stackName}-WebAcl`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${this.stackName}-WebAcl`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesAmazonIpReputationList',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesAmazonIpReputationList',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'RateLimitPerIp',
          priority: 10,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000, // 2000 requests per 5 min = ~400 req/min sustained
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitPerIp',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // Associate the WebACL with the HTTP API's default stage. The ResourceArn
    // for an HTTP API stage uses the apigateway service prefix, NOT apigatewayv2.
    const region = cdk.Stack.of(this).region;
    const apiId = this.httpApi.apiId;
    const stageArn = `arn:aws:apigateway:${region}::/apis/${apiId}/stages/$default`;
    new wafv2.CfnWebACLAssociation(this, 'WebAclAssociation', {
      resourceArn: stageArn,
      webAclArn: webAcl.attrArn,
    });

    // ─── Outputs ───
    new cdk.CfnOutput(this, 'ApiUrl', { value: this.httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'WebAclArn', { value: webAcl.attrArn });
  }
}
