import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';
import * as path from 'path';

interface CriticalLambdaSet {
  /** DeepResearch — gets a percentage-rate alarm (occasional bad inputs are normal). */
  deepResearch: lambda.IFunction;
  /** Weekly digest chain — every error pages (digest is mission-critical). */
  aggregateChanges: lambda.IFunction;
  generateSummary: lambda.IFunction;
  generateRecommendations: lambda.IFunction;
  renderSendEmail: lambda.IFunction;
  /** Phase 1 scheduled Lambdas — silent failure breaks the loop / cost cap. */
  enqueueRecurring: lambda.IFunction;
  aggregateAiCosts: lambda.IFunction;
  /** Phase 6c — silent failure means Command users miss their monthly briefing. */
  sendScheduledReports: lambda.IFunction;
  /** Phase 8a — silent failure means inactive users don't get re-engagement emails. */
  sendRetentionNudges: lambda.IFunction;
}

interface MonitoringStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  api: apigatewayv2.HttpApi;
  criticalLambdas: CriticalLambdaSet;
  /**
   * Optional owner email to subscribe to the alerts SNS topic. If unset,
   * the topic is still created so cdk synth succeeds; subscriptions can
   * be added manually post-deploy via the SNS console.
   */
  alertEmail?: string;
  /**
   * PipelineStack's cron dead-letter queue — this stack alarms on it.
   * (Each stack owns its OWN DLQ for its rules: the queue policy that lets
   * EventBridge deliver must reference the rule ARNs, so sharing Pipeline's
   * queue across stacks creates a cyclic cross-stack dependency.)
   */
  cronDlq: sqs.IQueue;
  /**
   * Monthly AWS cost budget in USD. The budget is only created when
   * `alertEmail` is set (CfnBudget notifications require a subscriber).
   */
  monthlyBudgetUsd?: number;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alertsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { table, api, criticalLambdas, alertEmail, cronDlq, monthlyBudgetUsd } = props;

    // ─── Alerts SNS Topic ───
    // One topic for every "page someone" alarm in this stack. Email is the
    // first subscriber; later phases can add Slack / PagerDuty subscribers
    // without touching alarm wiring.
    this.alertsTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: `${this.stackName}-Alerts`,
      displayName: 'RivalScan operational alerts',
    });
    if (alertEmail) {
      this.alertsTopic.addSubscription(new subs.EmailSubscription(alertEmail));
    }

    const alarmAction = new cwActions.SnsAction(this.alertsTopic);

    // ─── CloudWatch Dashboard ───
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${this.stackName}-Dashboard`,
    });

    // API Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Requests (5xx Errors)',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5xx',
            dimensionsMap: { ApiId: api.apiId },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Latency (p99)',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: { ApiId: api.apiId },
            statistic: 'p99',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
      })
    );

    // DynamoDB Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Read/Write Capacity',
        left: [
          table.metricConsumedReadCapacityUnits({ period: cdk.Duration.minutes(5) }),
          table.metricConsumedWriteCapacityUnits({ period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Throttled Requests',
        left: [
          table.metric('ReadThrottleEvents', { statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          table.metric('WriteThrottleEvents', { statistic: 'Sum', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      })
    );

    // ─── Pre-existing Alarms (now wired to SNS) ───

    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `${this.stackName}-Api5xxErrors`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5xx',
        dimensionsMap: { ApiId: api.apiId },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    api5xxAlarm.addAlarmAction(alarmAction);

    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: `${this.stackName}-ApiHighLatency`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: { ApiId: api.apiId },
        statistic: 'p99',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5000, // 5 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiLatencyAlarm.addAlarmAction(alarmAction);

    const ddbThrottleAlarm = new cloudwatch.Alarm(this, 'DdbThrottleAlarm', {
      alarmName: `${this.stackName}-DdbThrottled`,
      metric: table.metric('ReadThrottleEvents', {
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    ddbThrottleAlarm.addAlarmAction(alarmAction);

    // ─── Phase 1 Critical-Path Alarms ───
    // Helper: any-error alarm for mission-critical Lambdas where a single
    // failure should page. 5-min window so retries can absorb transient
    // errors before the alarm trips.
    const addAnyErrorAlarm = (id: string, fn: lambda.IFunction): void => {
      const alarm = new cloudwatch.Alarm(this, id, {
        alarmName: `${this.stackName}-${id}`,
        metric: fn.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(alarmAction);
    };

    addAnyErrorAlarm('AggregateChangesErrors', criticalLambdas.aggregateChanges);
    addAnyErrorAlarm('GenerateSummaryErrors', criticalLambdas.generateSummary);
    addAnyErrorAlarm('GenerateRecommendationsErrors', criticalLambdas.generateRecommendations);
    addAnyErrorAlarm('RenderSendEmailErrors', criticalLambdas.renderSendEmail);
    addAnyErrorAlarm('EnqueueRecurringErrors', criticalLambdas.enqueueRecurring);
    addAnyErrorAlarm('AggregateAiCostsErrors', criticalLambdas.aggregateAiCosts);
    addAnyErrorAlarm('SendScheduledReportsErrors', criticalLambdas.sendScheduledReports);
    addAnyErrorAlarm('SendRetentionNudgesErrors', criticalLambdas.sendRetentionNudges);

    // DeepResearch is occasionally going to fail on bad inputs (broken
    // competitor URLs, transient web_search failures, etc). Alert only on
    // sustained breakage: error-rate > 10% over a 15-minute window.
    const deepResearchErrorRate = new cloudwatch.MathExpression({
      expression: '(errors / invocations) * 100',
      usingMetrics: {
        errors: criticalLambdas.deepResearch.metricErrors({
          period: cdk.Duration.minutes(15),
          statistic: 'Sum',
        }),
        invocations: criticalLambdas.deepResearch.metricInvocations({
          period: cdk.Duration.minutes(15),
          statistic: 'Sum',
        }),
      },
      period: cdk.Duration.minutes(15),
      label: 'DeepResearch error %',
    });
    const deepResearchAlarm = new cloudwatch.Alarm(this, 'DeepResearchErrorRateAlarm', {
      alarmName: `${this.stackName}-DeepResearchErrorRate`,
      metric: deepResearchErrorRate,
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    deepResearchAlarm.addAlarmAction(alarmAction);

    // ─── SES bounce-rate alarm ───
    // SES emits Reputation.BounceRate as a fraction (0.0–1.0). 5% over a
    // 30-minute window indicates a real list-hygiene problem worth paging.
    const sesBounceAlarm = new cloudwatch.Alarm(this, 'SesBounceRateAlarm', {
      alarmName: `${this.stackName}-SesBounceRate`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SES',
        metricName: 'Reputation.BounceRate',
        statistic: 'Average',
        period: cdk.Duration.minutes(15),
      }),
      threshold: 0.05,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    sesBounceAlarm.addAlarmAction(alarmAction);

    // ─── Phase 9b: CloudTrail (audit logging for SOC 2 prep) ───
    // Multi-region trail capturing all management-plane API calls. Logs land
    // in a dedicated S3 bucket with object-lock + log-file-validation, so
    // tampering produces auditable evidence. Object-lock GOVERNANCE mode
    // (not COMPLIANCE) so a privileged role can lift retention if needed —
    // COMPLIANCE is the right move for prod once an SOC 2 auditor signs off.
    const auditLogBucket = new s3.Bucket(this, 'AuditLogBucket', {
      bucketName: `${this.stackName.toLowerCase()}-audit-logs`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true, // required for object-lock
      objectLockEnabled: true,
      objectLockDefaultRetention: s3.ObjectLockRetention.governance(cdk.Duration.days(365)),
      lifecycleRules: [
        {
          // Move to Glacier Instant Retrieval after 90 days — keeps audit
          // queries cheap (millis to retrieve) but storage at ~1/4 cost.
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          // 7-year retention covers typical SOC 2 + HIPAA + most state breach laws.
          expiration: cdk.Duration.days(2555),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN, // never auto-delete on stack destroy
    });

    const auditTrail = new cloudtrail.Trail(this, 'AuditTrail', {
      trailName: `${this.stackName}-AuditTrail`,
      bucket: auditLogBucket,
      isMultiRegionTrail: true,
      includeGlobalServiceEvents: true,
      enableFileValidation: true, // CloudTrail signs each log file for tamper-evidence
      managementEvents: cloudtrail.ReadWriteType.ALL,
    });

    new cdk.CfnOutput(this, 'AuditTrailArn', { value: auditTrail.trailArn });
    new cdk.CfnOutput(this, 'AuditLogBucketName', { value: auditLogBucket.bucketName });

    // ─── Phase 9b: OFAC SDN drift-detection cron ───
    // Scheduled Lambda fetches the public OFAC SDN XML weekly, hashes it,
    // alerts via the existing SNS topic on change. Lives in MonitoringStack
    // (not Pipeline) because (a) it's an audit-shaped concern colocated with
    // the alarms it depends on, and (b) it avoids a new cross-stack dep —
    // PipelineStack would have needed to import the SNS topic ARN, which
    // creates a circular reference with MonitoringStack consuming Pipeline's
    // criticalLambdas.
    const refreshOfacSdnFn = new nodejs.NodejsFunction(this, 'RefreshOfacSdn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      entry: path.join(__dirname, '..', '..', 'src', 'functions', 'scheduled', 'refresh-ofac-sdn.ts'),
      functionName: `${this.stackName}-RefreshOfacSdn`,
      logRetention: logs.RetentionDays.THREE_MONTHS,
      environment: {
        TABLE_NAME: table.tableName,
        ALERTS_TOPIC_ARN: this.alertsTopic.topicArn,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });
    table.grantReadWriteData(refreshOfacSdnFn);
    this.alertsTopic.grantPublish(refreshOfacSdnFn);

    // This stack's own rule DLQ — see the cronDlq prop doc for why it can't
    // reuse Pipeline's queue (cyclic queue-policy dependency).
    const monitoringCronDlq = new sqs.Queue(this, 'MonitoringCronDlq', {
      queueName: `${this.stackName}-CronDlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Weekly Saturday 7am UTC — outside of any other scheduled-job window.
    new events.Rule(this, 'OfacSdnRefreshCronRule', {
      ruleName: `${this.stackName}-OfacSdnRefreshCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '7', weekDay: 'SAT' }),
      targets: [
        new targets.LambdaFunction(refreshOfacSdnFn, {
          deadLetterQueue: monitoringCronDlq,
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(1),
        }),
      ],
    });

    // Page on any error — a failing OFAC fetch means our drift detection
    // is silently broken, which is exactly the kind of thing we want to know.
    const ofacErrorAlarm = new cloudwatch.Alarm(this, 'RefreshOfacSdnErrorsAlarm', {
      alarmName: `${this.stackName}-RefreshOfacSdnErrors`,
      metric: refreshOfacSdnFn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    ofacErrorAlarm.addAlarmAction(alarmAction);

    // ─── Cron DLQ alarms ───
    // Any message on either queue means EventBridge gave up delivering a
    // scheduled run (digest kickoff, recurring research, cost aggregation,
    // OFAC refresh, …) after its retries — a whole cron cycle silently lost
    // unless someone is paged.
    for (const [id, queue] of [
      ['PipelineCronDlqAlarm', cronDlq],
      ['MonitoringCronDlqAlarm', monitoringCronDlq],
    ] as const) {
      const dlqAlarm = new cloudwatch.Alarm(this, id, {
        alarmName: `${this.stackName}-${id}`,
        metric: queue.metricApproximateNumberOfMessagesVisible({
          period: cdk.Duration.minutes(5),
          statistic: 'Maximum',
        }),
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      dlqAlarm.addAlarmAction(alarmAction);
    }

    // ─── Monthly AWS cost budget ───
    // The account-level spend watchdog for a self-funded launch: alerts at
    // 80% actual, 100% actual, and 100% forecast. CfnBudget notifications
    // require at least one subscriber, so this only exists when an alert
    // email is configured — the synth warning keeps the gap visible.
    if (alertEmail) {
      const limitUsd = monthlyBudgetUsd ?? 50;
      new budgets.CfnBudget(this, 'MonthlyBudget', {
        budget: {
          budgetName: `${this.stackName}-monthly`,
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: limitUsd, unit: 'USD' },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              notificationType: 'ACTUAL',
              comparisonOperator: 'GREATER_THAN',
              threshold: 80,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [{ subscriptionType: 'EMAIL', address: alertEmail }],
          },
          {
            notification: {
              notificationType: 'ACTUAL',
              comparisonOperator: 'GREATER_THAN',
              threshold: 100,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [{ subscriptionType: 'EMAIL', address: alertEmail }],
          },
          {
            notification: {
              notificationType: 'FORECASTED',
              comparisonOperator: 'GREATER_THAN',
              threshold: 100,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [{ subscriptionType: 'EMAIL', address: alertEmail }],
          },
        ],
      });
    } else {
      cdk.Annotations.of(this).addWarning(
        'ALERT_EMAIL is unset — the monthly AWS budget was NOT created ' +
          '(budget notifications require a subscriber). Set ALERT_EMAIL and redeploy.'
      );
    }

    // ─── Output ───
    new cdk.CfnOutput(this, 'AlertsTopicArn', { value: this.alertsTopic.topicArn });
  }
}
