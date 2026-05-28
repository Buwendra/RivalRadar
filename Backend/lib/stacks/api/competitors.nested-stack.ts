import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { SharedRouteProps, routeContext, addRoute, addPdfRoute } from './route-factory';

export interface CompetitorRoutesStackProps extends cdk.NestedStackProps, SharedRouteProps {
  /** Research-trigger routes (competitor/brand research, brand setup) start it. */
  researchStateMachine: sfn.StateMachine;
  /** Research-run details endpoint tails this lambda's logs (Phase 22). */
  deepResearchFn: lambda.Function;
}

/**
 * Competitor CRUD + battlecards, Brand Pulse (self-brand), and research-run
 * observability routes. One of four route-group nested stacks under
 * {@link ApiStack}.
 */
export class CompetitorRoutesStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: CompetitorRoutesStackProps) {
    super(scope, id, props);

    const ctx = routeContext(this, props);
    const { HttpMethod } = apigatewayv2;
    const { researchStateMachine, deepResearchFn } = props;
    const pipelineEnv = { RESEARCH_PIPELINE_ARN: researchStateMachine.stateMachineArn };

    // ─── Competitor Routes ───
    addRoute(ctx, 'CompetitorList', HttpMethod.GET, '/competitors', 'api/competitors/list.ts');
    addRoute(ctx, 'CompetitorCreate', HttpMethod.POST, '/competitors', 'api/competitors/create.ts');
    // Phase 12 — CSV bulk import
    addRoute(ctx, 'CompetitorBulkImport', HttpMethod.POST, '/competitors/bulk-import', 'api/competitors/bulk-import.ts');
    // Phase 19 — cross-competitor comparison matrix (Strategist+)
    addRoute(ctx, 'CompetitorMatrix', HttpMethod.GET, '/competitors/matrix', 'api/competitors/matrix.ts');
    // Phase 20 — per-competitor battlecard generation (auth list + delete + public token)
    addRoute(ctx, 'BattlecardsList', HttpMethod.GET, '/battlecards', 'api/battlecards/list.ts');
    addRoute(ctx, 'BattlecardsDelete', HttpMethod.DELETE, '/battlecards/{id}', 'api/battlecards/delete.ts');
    addRoute(ctx, 'PublicBattlecard', HttpMethod.GET, '/public/battlecards/{token}', 'api/public/battlecard.ts', false);
    addRoute(ctx, 'CompetitorGet', HttpMethod.GET, '/competitors/{id}', 'api/competitors/get.ts');
    addRoute(ctx, 'CompetitorDelete', HttpMethod.DELETE, '/competitors/{id}', 'api/competitors/delete.ts');
    const researchFn = addRoute(ctx, 'CompetitorResearch', HttpMethod.POST, '/competitors/{id}/research', 'api/competitors/research.ts', true, pipelineEnv);
    researchStateMachine.grantStartExecution(researchFn);
    // Phase 7a — snooze toggle
    addRoute(ctx, 'CompetitorSnooze', HttpMethod.PATCH, '/competitors/{id}/snooze', 'api/competitors/snooze.ts');

    // Phase 20 — battlecard PDF generator (PDFKit cold start + S3 PUT).
    addPdfRoute(ctx, 'CompetitorBattlecard', '/competitors/{id}/battlecard', 'api/competitors/battlecard.ts');

    // ─── Brand Pulse (Phase 23) — self-brand monitoring ───
    addRoute(ctx, 'BrandGet', HttpMethod.GET, '/brand', 'api/brand/get.ts');
    addRoute(ctx, 'BrandCoverage', HttpMethod.GET, '/brand/coverage', 'api/brand/coverage.ts');
    addRoute(ctx, 'BrandSentiment', HttpMethod.GET, '/brand/sentiment', 'api/brand/sentiment.ts');
    // Phase 24 — Brand Health Score composite KPI.
    addRoute(ctx, 'BrandHealth', HttpMethod.GET, '/brand/health', 'api/brand/health.ts');
    // Seeds companyWebsite + the self-brand row for legacy (pre-Phase 23) users.
    // Re-added after the API stack was split into nested stacks (previously
    // omitted to stay under CloudFormation's 500-resource hard limit).
    const brandSetupFn = addRoute(ctx, 'BrandSetup', HttpMethod.POST, '/brand/setup', 'api/brand/setup.ts', true, pipelineEnv);
    researchStateMachine.grantStartExecution(brandSetupFn);
    const brandResearchFn = addRoute(ctx, 'BrandResearch', HttpMethod.POST, '/brand/research', 'api/brand/research.ts', true, pipelineEnv);
    researchStateMachine.grantStartExecution(brandResearchFn);

    // ─── Research-run observability (Phase 22) ───
    addRoute(ctx, 'ResearchRunsList', HttpMethod.GET, '/research-runs', 'api/research-runs/list.ts');
    addRoute(ctx, 'ResearchRunsGet', HttpMethod.GET, '/research-runs/{id}', 'api/research-runs/get.ts');
    // Lazy "Technical details" — pulls SFN execution history + CloudWatch tail.
    // Needs explicit grants the default `addRoute()` doesn't provide.
    const researchRunDetailsFn = addRoute(
      ctx,
      'ResearchRunsDetails',
      HttpMethod.GET,
      '/research-runs/{id}/details',
      'api/research-runs/details.ts',
      true,
      { DEEP_RESEARCH_LAMBDA_NAME: deepResearchFn.functionName }
    );
    researchRunDetailsFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['states:GetExecutionHistory', 'states:DescribeExecution'],
        resources: [
          researchStateMachine.stateMachineArn,
          `${researchStateMachine.stateMachineArn}:*`,
          `arn:aws:states:${this.region}:${this.account}:execution:${researchStateMachine.stateMachineName}:*`,
        ],
      })
    );
    researchRunDetailsFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['logs:FilterLogEvents'],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${deepResearchFn.functionName}:*`,
        ],
      })
    );
  }
}
