import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

interface PipelineStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  snapshotBucket: s3.Bucket;
}

export class PipelineStack extends cdk.Stack {
  public readonly weeklyStateMachine: sfn.StateMachine;
  public readonly researchStateMachine: sfn.StateMachine;

  // Critical Lambdas exposed for MonitoringStack to attach alarms.
  // Failure of any of these is user-visible: research breaks, digest goes
  // unsent, cost cap stops advancing, or the recurring loop silently dies.
  public readonly deepResearchFn: nodejs.NodejsFunction;
  public readonly aggregateChangesFn: nodejs.NodejsFunction;
  public readonly generateSummaryFn: nodejs.NodejsFunction;
  public readonly generateRecommendationsFn: nodejs.NodejsFunction;
  public readonly renderSendEmailFn: nodejs.NodejsFunction;
  public readonly enqueueRecurringFn: nodejs.NodejsFunction;
  public readonly aggregateAiCostsFn: nodejs.NodejsFunction;
  public readonly sendScheduledReportsFn: nodejs.NodejsFunction;
  public readonly sendRetentionNudgesFn: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const { table, snapshotBucket } = props;

    const apiSecrets = secretsmanager.Secret.fromSecretNameV2(
      this, 'ApiSecrets', 'rivalscan/api-keys'
    );

    const sharedEnv = {
      TABLE_NAME: table.tableName,
      BUCKET_NAME: snapshotBucket.bucketName,
      SECRETS_ARN: apiSecrets.secretArn,
      FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      STACK_NAME: this.stackName,
    };

    const lambdaDefaults: nodejs.NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: sharedEnv,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    };

    const fnPath = (...parts: string[]) => path.join(__dirname, '..', '..', 'src', 'functions', ...parts);

    // Helper to create a pipeline Lambda with default permissions
    const createPipelineFn = (name: string, entry: string, extraTimeout?: cdk.Duration) => {
      const fn = new nodejs.NodejsFunction(this, name, {
        ...lambdaDefaults,
        entry: fnPath(entry),
        functionName: `${this.stackName}-${name}`,
        timeout: extraTimeout ?? lambdaDefaults.timeout,
      });
      table.grantReadWriteData(fn);
      apiSecrets.grantRead(fn);
      return fn;
    };

    // ─── Deep Research Lambda ───
    // Larger memory & longer timeout — Claude web_search + delta synthesis can take 90-150s.
    this.deepResearchFn = new nodejs.NodejsFunction(this, 'DeepResearch', {
      ...lambdaDefaults,
      entry: fnPath('pipeline/deep-research.ts'),
      functionName: `${this.stackName}-DeepResearch`,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
    });
    table.grantReadWriteData(this.deepResearchFn);
    apiSecrets.grantRead(this.deepResearchFn);

    const sendAlertFn = createPipelineFn('SendAlert', 'pipeline/send-alert.ts');

    // ─── Weekly Digest Lambdas ───
    const getSubscribersFn = createPipelineFn('GetSubscribers', 'scheduled/get-subscribers.ts');
    this.aggregateChangesFn = createPipelineFn('AggregateChanges', 'scheduled/aggregate-changes.ts');
    this.generateSummaryFn = createPipelineFn('GenerateSummary', 'scheduled/generate-summary.ts');
    this.generateRecommendationsFn = createPipelineFn(
      'GenerateRecommendations',
      'scheduled/generate-recommendations.ts'
    );
    this.renderSendEmailFn = createPipelineFn('RenderSendEmail', 'scheduled/render-send-email.ts');

    // ─── Weekly Digest State Machine ───
    const getSubscribersTask = new tasks.LambdaInvoke(this, 'GetSubscribersTask', {
      lambdaFunction: getSubscribersFn,
      outputPath: '$.Payload',
    });

    const aggregateTask = new tasks.LambdaInvoke(this, 'AggregateChangesTask', {
      lambdaFunction: this.aggregateChangesFn,
      outputPath: '$.Payload',
    });

    const summaryTask = new tasks.LambdaInvoke(this, 'GenerateSummaryTask', {
      lambdaFunction: this.generateSummaryFn,
      outputPath: '$.Payload',
    });

    const recommendationsTask = new tasks.LambdaInvoke(this, 'GenerateRecommendationsTask', {
      lambdaFunction: this.generateRecommendationsFn,
      outputPath: '$.Payload',
    });

    const emailTask = new tasks.LambdaInvoke(this, 'RenderSendEmailTask', {
      lambdaFunction: this.renderSendEmailFn,
      outputPath: '$.Payload',
    });

    const perSubscriberChain = aggregateTask.next(summaryTask).next(recommendationsTask).next(emailTask);

    const mapSubscribers = new sfn.Map(this, 'MapSubscribers', {
      itemsPath: '$.subscribers',
      maxConcurrency: 5,
      resultPath: '$.results',
    });
    mapSubscribers.itemProcessor(perSubscriberChain);

    const weeklyDefinition = getSubscribersTask.next(mapSubscribers);

    this.weeklyStateMachine = new sfn.StateMachine(this, 'WeeklyDigest', {
      stateMachineName: `${this.stackName}-WeeklyDigest`,
      definitionBody: sfn.DefinitionBody.fromChainable(weeklyDefinition),
      timeout: cdk.Duration.hours(1),
      tracingEnabled: true,
    });

    // ─── Comparative Briefing State Machine (Phase 24) ───
    // Runs Mon 10am UTC — 2h after the standard digest, 1h after the saved-view
    // digests. Subscribers must opt in via notificationPreferences.email
    // .comparativeBrief. Email-only — no Slack/webhook fan-out at v1.
    const getComparativeSubscribersFn = createPipelineFn(
      'GetComparativeSubscribers',
      'scheduled/get-comparative-subscribers.ts'
    );
    const aggregateBrandCoverageFn = createPipelineFn(
      'AggregateBrandCoverage',
      'scheduled/aggregate-brand-coverage.ts'
    );
    const generateComparativeBriefingFn = createPipelineFn(
      'GenerateComparativeBriefing',
      'scheduled/generate-comparative-briefing.ts'
    );
    const renderSendComparativeBriefFn = createPipelineFn(
      'RenderSendComparativeBrief',
      'scheduled/render-send-comparative-brief.ts'
    );
    renderSendComparativeBriefFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    const getComparativeSubscribersTask = new tasks.LambdaInvoke(
      this,
      'GetComparativeSubscribersTask',
      { lambdaFunction: getComparativeSubscribersFn, outputPath: '$.Payload' }
    );
    const aggregateBrandCoverageTask = new tasks.LambdaInvoke(
      this,
      'AggregateBrandCoverageTask',
      { lambdaFunction: aggregateBrandCoverageFn, outputPath: '$.Payload' }
    );
    const generateComparativeBriefingTask = new tasks.LambdaInvoke(
      this,
      'GenerateComparativeBriefingTask',
      { lambdaFunction: generateComparativeBriefingFn, outputPath: '$.Payload' }
    );
    const renderSendComparativeBriefTask = new tasks.LambdaInvoke(
      this,
      'RenderSendComparativeBriefTask',
      { lambdaFunction: renderSendComparativeBriefFn, outputPath: '$.Payload' }
    );

    const perComparativeSubscriberChain = aggregateBrandCoverageTask
      .next(generateComparativeBriefingTask)
      .next(renderSendComparativeBriefTask);

    const mapComparativeSubscribers = new sfn.Map(this, 'MapComparativeSubscribers', {
      itemsPath: '$.subscribers',
      maxConcurrency: 5,
      resultPath: '$.results',
    });
    mapComparativeSubscribers.itemProcessor(perComparativeSubscriberChain);

    const comparativeDefinition = getComparativeSubscribersTask.next(mapComparativeSubscribers);

    const comparativeStateMachine = new sfn.StateMachine(this, 'ComparativeBriefing', {
      stateMachineName: `${this.stackName}-ComparativeBriefing`,
      definitionBody: sfn.DefinitionBody.fromChainable(comparativeDefinition),
      timeout: cdk.Duration.hours(1),
      tracingEnabled: true,
    });

    // ─── Research Pipeline State Machine ───
    // Input: { competitors: [{ competitorId, userId, name, url, industry? }] }
    // Per competitor: DeepResearch (research + delta detection + store changes) → SendAlert.
    const deepResearchTask = new tasks.LambdaInvoke(this, 'DeepResearchTask', {
      lambdaFunction: this.deepResearchFn,
      outputPath: '$.Payload',
    });

    const sendAlertTask = new tasks.LambdaInvoke(this, 'SendAlertTask', {
      lambdaFunction: sendAlertFn,
      outputPath: '$.Payload',
    });

    const perCompetitorResearchChain = deepResearchTask.next(sendAlertTask);

    // Concurrency 1: serialize competitor research runs to avoid exhausting
    // Anthropic's per-minute input-token rate limit (30k), which is org-wide.
    // Each research run burns ~10-20k input tokens across two Sonnet calls.
    const mapResearch = new sfn.Map(this, 'MapResearch', {
      itemsPath: '$.competitors',
      maxConcurrency: 1,
      resultPath: '$.results',
    });
    mapResearch.itemProcessor(perCompetitorResearchChain);
    mapResearch.addCatch(new sfn.Pass(this, 'CatchResearchMapError'), {
      resultPath: '$.mapError',
    });

    this.researchStateMachine = new sfn.StateMachine(this, 'ResearchPipeline', {
      stateMachineName: `${this.stackName}-ResearchPipeline`,
      definitionBody: sfn.DefinitionBody.fromChainable(mapResearch),
      timeout: cdk.Duration.hours(1),
      tracingEnabled: true,
    });

    // ─── Recurring Research Enqueuer Lambda ───
    // Runs Sunday 6am UTC (~26h before the digest aggregation kicks off Monday
    // 8am UTC) — enough buffer for the Map state's serialized per-competitor
    // research runs to complete before the digest reads the change feed.
    this.enqueueRecurringFn = new nodejs.NodejsFunction(this, 'EnqueueRecurringResearch', {
      ...lambdaDefaults,
      entry: fnPath('pipeline/enqueue-recurring-research.ts'),
      functionName: `${this.stackName}-EnqueueRecurringResearch`,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        ...sharedEnv,
        RESEARCH_PIPELINE_ARN: this.researchStateMachine.stateMachineArn,
      },
    });
    table.grantReadWriteData(this.enqueueRecurringFn);
    apiSecrets.grantRead(this.enqueueRecurringFn); // eligibility classifier reads ANTHROPIC_API_KEY
    this.researchStateMachine.grantStartExecution(this.enqueueRecurringFn);

    // ─── Daily AI Cost Aggregator Lambda ───
    // Runs at 3am UTC. Reads the prior day's `ai_call_completed` log lines
    // via CloudWatch Logs Insights, rolls them up into per-user CostDay rows
    // and updates each user's monthToDateCostUsd cache. The eligibility helper
    // reads that cache to enforce monthly cost caps.
    this.aggregateAiCostsFn = new nodejs.NodejsFunction(this, 'AggregateAiCosts', {
      ...lambdaDefaults,
      entry: fnPath('scheduled/aggregate-ai-costs.ts'),
      functionName: `${this.stackName}-AggregateAiCosts`,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });
    table.grantReadWriteData(this.aggregateAiCostsFn);
    this.aggregateAiCostsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'logs:DescribeLogGroups',
          'logs:StartQuery',
          'logs:GetQueryResults',
          'logs:StopQuery',
        ],
        // Logs Insights queries require '*' for the Describe/Start actions
        // because they target multiple log groups dynamically. Logs API is
        // already scoped to the account/region by the credential context.
        resources: ['*'],
      })
    );

    // ─── EventBridge Schedules ───

    // Weekly Monday at 8:00 AM UTC — digest email
    new events.Rule(this, 'WeeklyCronRule', {
      ruleName: `${this.stackName}-WeeklyCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '8', weekDay: 'MON' }),
      targets: [new targets.SfnStateMachine(this.weeklyStateMachine)],
    });

    // Weekly Monday at 10:00 AM UTC — Comparative Briefing (Phase 24).
    // Offset 2h after the competitive digest and 1h after the saved-view
    // digests so the three weekly emails don't pile up in the same minute.
    new events.Rule(this, 'ComparativeBriefingCronRule', {
      ruleName: `${this.stackName}-ComparativeBriefingCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '10', weekDay: 'MON' }),
      targets: [new targets.SfnStateMachine(comparativeStateMachine)],
    });

    // Weekly Sunday at 6:00 AM UTC — recurring research enqueuer
    new events.Rule(this, 'RecurringResearchCronRule', {
      ruleName: `${this.stackName}-RecurringResearchCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '6', weekDay: 'SUN' }),
      targets: [new targets.LambdaFunction(this.enqueueRecurringFn)],
    });

    // Daily 3:00 AM UTC — AI cost aggregator
    new events.Rule(this, 'AggregateAiCostsCronRule', {
      ruleName: `${this.stackName}-AggregateAiCostsCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '3' }),
      targets: [new targets.LambdaFunction(this.aggregateAiCostsFn)],
    });

    // ─── Send Scheduled Reports Lambda (Phase 6c) ───
    // PDFKit + S3 upload + SES per user — bumped memory + timeout to match
    // the on-demand /exports/pdf handler. The cron runs once a month so
    // cold-start cost is irrelevant.
    this.sendScheduledReportsFn = new nodejs.NodejsFunction(this, 'SendScheduledReports', {
      ...lambdaDefaults,
      entry: fnPath('scheduled/send-scheduled-reports.ts'),
      functionName: `${this.stackName}-SendScheduledReports`,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      bundling: {
        ...lambdaDefaults.bundling,
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling(inputDir: string, outputDir: string) {
            // Same .afm font copy as the api/exports/pdf handler.
            return [
              `node -e "const fs=require('fs'),path=require('path');const src=path.join('${inputDir.replace(/\\/g, '/')}','node_modules/pdfkit/js/data');const dst=path.join('${outputDir.replace(/\\/g, '/')}','data');if(fs.existsSync(src)){fs.mkdirSync(dst,{recursive:true});for(const f of fs.readdirSync(src))fs.copyFileSync(path.join(src,f),path.join(dst,f));}"`,
            ];
          },
        },
      },
    });
    table.grantReadWriteData(this.sendScheduledReportsFn);
    snapshotBucket.grantReadWrite(this.sendScheduledReportsFn);
    // SES send permission — the email-sending sibling Lambdas (send-alert,
    // render-send-email) implicitly rely on either a verified identity policy
    // or an account-level default; making it explicit here so the new Lambda
    // doesn't depend on undocumented setup.
    this.sendScheduledReportsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    // Monthly cron — 1st of every month at 8:00 AM UTC
    new events.Rule(this, 'MonthlyReportsCronRule', {
      ruleName: `${this.stackName}-MonthlyReportsCron`,
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '8',
        day: '1',
        month: '*',
        year: '*',
      }),
      targets: [new targets.LambdaFunction(this.sendScheduledReportsFn)],
    });

    // ─── Send Retention Nudges Lambda (Phase 8a) ───
    // Daily 4am UTC scan for users who haven't logged in for 7+ days.
    // Quarterly cap on per-user nudges enforced inside the handler.
    this.sendRetentionNudgesFn = createPipelineFn(
      'SendRetentionNudges',
      'scheduled/send-retention-nudges.ts'
    );
    this.sendRetentionNudgesFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );
    new events.Rule(this, 'DailyRetentionCronRule', {
      ruleName: `${this.stackName}-DailyRetentionCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '4' }),
      targets: [new targets.LambdaFunction(this.sendRetentionNudgesFn)],
    });

    // ─── Send Saved-View Digests Lambda (Phase 15) ───
    // Weekly Mon 9am UTC (1h after the regular weekly digest at 8am).
    // Walks SavedViewSubscription rows via Scan, groups by (workspaceId,
    // viewId), renders per-view digests, fans out emails to each
    // subscriber. Direct EventBridge → Lambda (no state machine — fan-out
    // is small at v1 volume).
    const sendSavedViewDigestsFn = createPipelineFn(
      'SendSavedViewDigests',
      'scheduled/send-saved-view-digests.ts'
    );
    sendSavedViewDigestsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );
    new events.Rule(this, 'SavedViewDigestsCronRule', {
      ruleName: `${this.stackName}-SavedViewDigestsCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '9', weekDay: 'MON' }),
      targets: [new targets.LambdaFunction(sendSavedViewDigestsFn)],
    });

    // ─── Outputs ───
    new cdk.CfnOutput(this, 'WeeklyDigestArn', { value: this.weeklyStateMachine.stateMachineArn });
    new cdk.CfnOutput(this, 'ResearchPipelineArn', { value: this.researchStateMachine.stateMachineArn });

    // Keep the prop referenced so CDK doesn't complain about unused `snapshotBucket`
    // The S3 bucket remains in StorageStack as a no-op until fully decommissioned.
    void snapshotBucket;
  }
}
