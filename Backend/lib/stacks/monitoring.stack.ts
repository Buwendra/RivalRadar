import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  api: apigatewayv2.HttpApi;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { table, api } = props;

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

    // ─── Alarms ───

    // API 5xx error alarm
    new cloudwatch.Alarm(this, 'Api5xxAlarm', {
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

    // API high latency alarm
    new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
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

    // DynamoDB throttle alarm
    new cloudwatch.Alarm(this, 'DdbThrottleAlarm', {
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
  }
}
