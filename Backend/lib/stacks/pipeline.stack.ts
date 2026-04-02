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
import { Construct } from 'constructs';
import * as path from 'path';

interface PipelineStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  snapshotBucket: s3.Bucket;
}

export class PipelineStack extends cdk.Stack {
  public readonly dailyStateMachine: sfn.StateMachine;
  public readonly weeklyStateMachine: sfn.StateMachine;

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

    // Helper to create pipeline Lambda with permissions
    const createPipelineFn = (name: string, entry: string, extraTimeout?: cdk.Duration) => {
      const fn = new nodejs.NodejsFunction(this, name, {
        ...lambdaDefaults,
        entry: fnPath(entry),
        functionName: `${this.stackName}-${name}`,
        timeout: extraTimeout ?? lambdaDefaults.timeout,
      });
      table.grantReadWriteData(fn);
      snapshotBucket.grantReadWrite(fn);
      apiSecrets.grantRead(fn);
      return fn;
    };

    // ─── Daily Pipeline Lambdas ───
    const getCompetitorsFn = createPipelineFn('GetCompetitors', 'pipeline/get-competitors.ts');
    const scrapePagesFn = createPipelineFn('ScrapePages', 'pipeline/scrape-pages.ts', cdk.Duration.minutes(10));
    const storeSnapshotsFn = createPipelineFn('StoreSnapshots', 'pipeline/store-snapshots.ts');
    const detectDiffsFn = createPipelineFn('DetectDiffs', 'pipeline/detect-diffs.ts');
    const analyzeChangeFn = createPipelineFn('AnalyzeChange', 'pipeline/analyze-change.ts', cdk.Duration.minutes(5));
    const storeChangeFn = createPipelineFn('StoreChange', 'pipeline/store-change.ts');
    const sendAlertFn = createPipelineFn('SendAlert', 'pipeline/send-alert.ts');

    // ─── Weekly Digest Lambdas ───
    const getSubscribersFn = createPipelineFn('GetSubscribers', 'scheduled/get-subscribers.ts');
    const aggregateChangesFn = createPipelineFn('AggregateChanges', 'scheduled/aggregate-changes.ts');
    const generateSummaryFn = createPipelineFn('GenerateSummary', 'scheduled/generate-summary.ts');
    const renderSendEmailFn = createPipelineFn('RenderSendEmail', 'scheduled/render-send-email.ts');

    // ─── Daily Pipeline State Machine ───
    const getCompetitorsTask = new tasks.LambdaInvoke(this, 'GetCompetitorsTask', {
      lambdaFunction: getCompetitorsFn,
      outputPath: '$.Payload',
    });

    // Per-competitor processing chain
    const scrapePagesTask = new tasks.LambdaInvoke(this, 'ScrapePagesTask', {
      lambdaFunction: scrapePagesFn,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    const storeSnapshotsTask = new tasks.LambdaInvoke(this, 'StoreSnapshotsTask', {
      lambdaFunction: storeSnapshotsFn,
      outputPath: '$.Payload',
    });

    const detectDiffsTask = new tasks.LambdaInvoke(this, 'DetectDiffsTask', {
      lambdaFunction: detectDiffsFn,
      outputPath: '$.Payload',
    });

    const analyzeChangeTask = new tasks.LambdaInvoke(this, 'AnalyzeChangeTask', {
      lambdaFunction: analyzeChangeFn,
      outputPath: '$.Payload',
    });

    const storeChangeTask = new tasks.LambdaInvoke(this, 'StoreChangeTask', {
      lambdaFunction: storeChangeFn,
      outputPath: '$.Payload',
    });

    const sendAlertTask = new tasks.LambdaInvoke(this, 'SendAlertTask', {
      lambdaFunction: sendAlertFn,
      outputPath: '$.Payload',
    });

    // Chain: scrape → store → diff → analyze → store change → alert
    const perCompetitorChain = scrapePagesTask
      .next(storeSnapshotsTask)
      .next(detectDiffsTask)
      .next(analyzeChangeTask)
      .next(storeChangeTask)
      .next(sendAlertTask);

    // Map over all competitors with parallel processing
    const mapCompetitors = new sfn.Map(this, 'MapCompetitors', {
      itemsPath: '$.competitors',
      maxConcurrency: 10,
      resultPath: '$.results',
    });
    mapCompetitors.itemProcessor(perCompetitorChain);

    // Add retry policy to scrape task
    scrapePagesTask.addRetry({
      errors: ['States.ALL'],
      maxAttempts: 3,
      interval: cdk.Duration.seconds(10),
      backoffRate: 2,
    });

    // Add catch for individual competitor failures
    mapCompetitors.addCatch(new sfn.Pass(this, 'CatchMapError'), {
      resultPath: '$.mapError',
    });

    const dailyDefinition = getCompetitorsTask.next(mapCompetitors);

    this.dailyStateMachine = new sfn.StateMachine(this, 'DailyPipeline', {
      stateMachineName: `${this.stackName}-DailyPipeline`,
      definitionBody: sfn.DefinitionBody.fromChainable(dailyDefinition),
      timeout: cdk.Duration.hours(2),
      tracingEnabled: true,
    });

    // ─── Weekly Digest State Machine ───
    const getSubscribersTask = new tasks.LambdaInvoke(this, 'GetSubscribersTask', {
      lambdaFunction: getSubscribersFn,
      outputPath: '$.Payload',
    });

    const aggregateTask = new tasks.LambdaInvoke(this, 'AggregateChangesTask', {
      lambdaFunction: aggregateChangesFn,
      outputPath: '$.Payload',
    });

    const summaryTask = new tasks.LambdaInvoke(this, 'GenerateSummaryTask', {
      lambdaFunction: generateSummaryFn,
      outputPath: '$.Payload',
    });

    const emailTask = new tasks.LambdaInvoke(this, 'RenderSendEmailTask', {
      lambdaFunction: renderSendEmailFn,
      outputPath: '$.Payload',
    });

    const perSubscriberChain = aggregateTask.next(summaryTask).next(emailTask);

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

    // ─── EventBridge Schedules ───

    // Daily at 6:00 AM UTC
    new events.Rule(this, 'DailyCronRule', {
      ruleName: `${this.stackName}-DailyCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '6' }),
      targets: [new targets.SfnStateMachine(this.dailyStateMachine)],
    });

    // Weekly Monday at 8:00 AM UTC
    new events.Rule(this, 'WeeklyCronRule', {
      ruleName: `${this.stackName}-WeeklyCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '8', weekDay: 'MON' }),
      targets: [new targets.SfnStateMachine(this.weeklyStateMachine)],
    });

    // ─── Outputs ───
    new cdk.CfnOutput(this, 'DailyPipelineArn', { value: this.dailyStateMachine.stateMachineArn });
    new cdk.CfnOutput(this, 'WeeklyDigestArn', { value: this.weeklyStateMachine.stateMachineArn });
  }
}
