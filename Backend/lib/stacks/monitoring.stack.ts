import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

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
}

export class MonitoringStack extends cdk.Stack {
  public readonly alertsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { table, api, criticalLambdas, alertEmail } = props;

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

    // ─── Output ───
    new cdk.CfnOutput(this, 'AlertsTopicArn', { value: this.alertsTopic.topicArn });
  }
}
