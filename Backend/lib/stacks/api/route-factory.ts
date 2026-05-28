import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Auth from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as apigatewayv2Int from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * Shared inputs every route-group nested stack receives from the parent
 * {@link ApiStack}. All fields are either string tokens or construct refs that
 * cross the parent→nested-stack boundary cleanly (CDK auto-plumbs them via
 * CfnParameters). Build `sharedEnv` + `lambdaDefaults` ONCE in the parent and
 * pass them down so every group's Lambdas are byte-for-byte identical.
 */
export interface SharedRouteProps {
  /** The parent's HTTP API. Passing the concrete instance (not an imported
   *  IHttpApi) is load-bearing: `HttpRoute` binds the Cognito authorizer with
   *  `scope = httpApi` when `httpApi instanceof Construct`, so the single
   *  `CfnAuthorizer` lands in the PARENT stack and all groups share it. */
  httpApi: apigatewayv2.HttpApi;
  authorizer: apigatewayv2Auth.HttpUserPoolAuthorizer;
  table: dynamodb.ITable;
  snapshotBucket: s3.IBucket;
  apiSecrets: secretsmanager.ISecret;
  sharedEnv: Record<string, string>;
  lambdaDefaults: nodejs.NodejsFunctionProps;
  /** Absolute path to `Backend/src/functions`, computed in the parent. */
  entryRoot: string;
}

/** {@link SharedRouteProps} bound to a concrete construct scope (the nested stack). */
export interface RouteContext extends SharedRouteProps {
  scope: Construct;
}

/** Build a {@link RouteContext} for a nested stack from its props. */
export function routeContext(scope: Construct, props: SharedRouteProps): RouteContext {
  return {
    scope,
    httpApi: props.httpApi,
    authorizer: props.authorizer,
    table: props.table,
    snapshotBucket: props.snapshotBucket,
    apiSecrets: props.apiSecrets,
    sharedEnv: props.sharedEnv,
    lambdaDefaults: props.lambdaDefaults,
    entryRoot: props.entryRoot,
  };
}

/**
 * PDFKit ships AFM font metrics as `.afm` files. esbuild treats them as binary
 * assets and won't bundle them automatically; this hook copies them into the
 * bundle preserving the relative path PDFKit reads at runtime. Used by every
 * PDF lambda (was duplicated inline per-lambda before the stack split).
 */
const pdfkitFontHook = (inputDir: string, outputDir: string): string[] => [
  `node -e "const fs=require('fs'),path=require('path');const src=path.join('${inputDir.replace(/\\/g, '/')}','node_modules/pdfkit/js/data');const dst=path.join('${outputDir.replace(/\\/g, '/')}','data');if(fs.existsSync(src)){fs.mkdirSync(dst,{recursive:true});for(const f of fs.readdirSync(src))fs.copyFileSync(path.join(src,f),path.join(dst,f));}"`,
];

/**
 * Create a Lambda + HTTP route in `ctx.scope` (a nested stack). Mirrors the old
 * in-class `addRoute()` helper but uses `new HttpRoute(scope, ...)` instead of
 * `httpApi.addRoutes(...)` so the Route/Integration/Permission land in the
 * nested stack rather than the HttpApi's (parent) stack.
 *
 * Returns the function so callers can attach per-function extras (extra IAM
 * policies, state-machine grants, etc.).
 *
 * Note: no explicit `functionName` — CDK auto-generates a unique-per-construct
 * name (truncated to Lambda's 64-char limit with a hash). This avoids a
 * mid-deploy "function already exists" collision while routes migrate between
 * stacks, and is safe because no handler reads its own name.
 */
export function addRoute(
  ctx: RouteContext,
  routeId: string,
  method: apigatewayv2.HttpMethod,
  routePath: string,
  entry: string,
  auth: boolean = true,
  extraEnv?: Record<string, string>
): nodejs.NodejsFunction {
  const fn = new nodejs.NodejsFunction(ctx.scope, routeId, {
    ...ctx.lambdaDefaults,
    entry: path.join(ctx.entryRoot, entry),
    environment: { ...ctx.sharedEnv, ...extraEnv },
  });

  ctx.table.grantReadWriteData(fn);
  ctx.snapshotBucket.grantReadWrite(fn);
  ctx.apiSecrets.grantRead(fn);

  new apigatewayv2.HttpRoute(ctx.scope, `${routeId}Route`, {
    httpApi: ctx.httpApi,
    routeKey: apigatewayv2.HttpRouteKey.with(routePath, method),
    integration: new apigatewayv2Int.HttpLambdaIntegration(`${routeId}-Int`, fn),
    authorizer: auth ? ctx.authorizer : undefined,
  });

  return fn;
}

/**
 * Like {@link addRoute} but for the PDF-generating lambdas (battlecard / weekly
 * briefing): more memory + a longer timeout for PDFKit cold start + S3 PUT, and
 * the `.afm` font-asset copy hook. Always POST + Cognito-authorized.
 */
export function addPdfRoute(
  ctx: RouteContext,
  routeId: string,
  routePath: string,
  entry: string
): nodejs.NodejsFunction {
  const fn = new nodejs.NodejsFunction(ctx.scope, routeId, {
    ...ctx.lambdaDefaults,
    entry: path.join(ctx.entryRoot, entry),
    timeout: cdk.Duration.seconds(60),
    memorySize: 1024,
    bundling: {
      ...ctx.lambdaDefaults.bundling,
      commandHooks: {
        beforeBundling: () => [],
        beforeInstall: () => [],
        afterBundling: pdfkitFontHook,
      },
    },
  });

  ctx.table.grantReadWriteData(fn);
  ctx.snapshotBucket.grantReadWrite(fn);
  ctx.apiSecrets.grantRead(fn);

  new apigatewayv2.HttpRoute(ctx.scope, `${routeId}Route`, {
    httpApi: ctx.httpApi,
    routeKey: apigatewayv2.HttpRouteKey.with(routePath, apigatewayv2.HttpMethod.POST),
    integration: new apigatewayv2Int.HttpLambdaIntegration(`${routeId}-Int`, fn),
    authorizer: ctx.authorizer,
  });

  return fn;
}
