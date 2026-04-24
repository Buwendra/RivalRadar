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
  public readonly weeklyStateMachine: sfn.StateMachine;
  public readonly researchStateMachine: sfn.StateMachine;

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
    const deepResearchFn = new nodejs.NodejsFunction(this, 'DeepResearch', {
      ...lambdaDefaults,
      entry: fnPath('pipeline/deep-research.ts'),
      functionName: `${this.stackName}-DeepResearch`,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
    });
    table.grantReadWriteData(deepResearchFn);
    apiSecrets.grantRead(deepResearchFn);

    const sendAlertFn = createPipelineFn('SendAlert', 'pipeline/send-alert.ts');

    // ─── Weekly Digest Lambdas ───
    const getSubscribersFn = createPipelineFn('GetSubscribers', 'scheduled/get-subscribers.ts');
    const aggregateChangesFn = createPipelineFn('AggregateChanges', 'scheduled/aggregate-changes.ts');
    const generateSummaryFn = createPipelineFn('GenerateSummary', 'scheduled/generate-summary.ts');
    const renderSendEmailFn = createPipelineFn('RenderSendEmail', 'scheduled/render-send-email.ts');

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

    // ─── Research Pipeline State Machine ───
    // Input: { competitors: [{ competitorId, userId, name, url, industry? }] }
    // Per competitor: DeepResearch (research + delta detection + store changes) → SendAlert.
    const deepResearchTask = new tasks.LambdaInvoke(this, 'DeepResearchTask', {
      lambdaFunction: deepResearchFn,
      outputPath: '$.Payload',
    });

    const sendAlertTask = new tasks.LambdaInvoke(this, 'SendAlertTask', {
      lambdaFunction: sendAlertFn,
      outputPath: '$.Payload',
    });

    const perCompetitorResearchChain = deepResearchTask.next(sendAlertTask);

    const mapResearch = new sfn.Map(this, 'MapResearch', {
      itemsPath: '$.competitors',
      maxConcurrency: 3,
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

    // ─── EventBridge Schedules ───

    // Weekly Monday at 8:00 AM UTC — digest email
    new events.Rule(this, 'WeeklyCronRule', {
      ruleName: `${this.stackName}-WeeklyCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '8', weekDay: 'MON' }),
      targets: [new targets.SfnStateMachine(this.weeklyStateMachine)],
    });

    // ─── Outputs ───
    new cdk.CfnOutput(this, 'WeeklyDigestArn', { value: this.weeklyStateMachine.stateMachineArn });
    new cdk.CfnOutput(this, 'ResearchPipelineArn', { value: this.researchStateMachine.stateMachineArn });

    // Keep the prop referenced so CDK doesn't complain about unused `snapshotBucket`
    // The S3 bucket remains in StorageStack as a no-op until fully decommissioned.
    void snapshotBucket;
  }
}
