import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * Phase 8c — public status page.
 *
 * Private S3 bucket fronted by CloudFront via Origin Access Control. A small
 * Lambda subscribed to the existing alerts SNS topic re-renders the page on
 * alarm state changes by reading the CURRENT alarm state via DescribeAlarms
 * (the SNS message itself isn't authoritative — alarms can flap and we want
 * the page to reflect actual state). Daily cron keeps the "as of" timestamp
 * fresh even when nothing's changed.
 *
 * DNS: CloudFront issues a default `*.cloudfront.net` URL out of the box.
 * For a custom domain (status.kironyx.com), the owner adds a CNAME at the
 * registrar pointing at the CloudFront distribution. That step is manual —
 * not codified here so DNS changes don't block CDK deploys.
 */

interface StatusPageStackProps extends cdk.StackProps {
  /** SNS topic from MonitoringStack — the Lambda subscribes for alarm-change events. */
  alertsTopic: sns.ITopic;
  /** Stage name for log + alarm filtering — only alarms whose name starts with this prefix are surfaced. */
  alarmNamePrefix: string;
}

export class StatusPageStack extends cdk.Stack {
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: StatusPageStackProps) {
    super(scope, id, props);

    const { alertsTopic, alarmNamePrefix } = props;

    // ─── Private S3 bucket ───
    // No public access — CloudFront reads via OAC. Versioning off (status
    // pages overwrite cleanly), no lifecycle (the page is small and changes
    // rarely — keeping every revision is harmless).
    const bucket = new s3.Bucket(this, 'StatusPageBucket', {
      bucketName: `${this.stackName.toLowerCase()}-status`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ─── CloudFront distribution with Origin Access Control ───
    // OAC is the modern replacement for OAI (Origin Access Identity) — uses
    // SigV4 signed requests to S3 instead of an S3 bucket policy keyed by
    // CloudFront's internal user.
    const distribution = new cloudfront.Distribution(this, 'StatusPageDistribution', {
      comment: `${this.stackName} status page`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // Status pages are read-heavy. Default cache policy is fine; the
        // updater Lambda issues an invalidation after every write so users
        // see fresh content within ~30 seconds of an alarm change.
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      // No custom domain — owner adds an alias record + ACM cert later.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US/EU only — cheapest tier
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(60),
        },
      ],
    });

    this.distributionDomainName = distribution.distributionDomainName;

    // ─── Updater Lambda ───
    // Reads CURRENT alarm state (not the SNS message — SNS only carries the
    // delta), renders HTML, writes to S3, invalidates CloudFront. Memory
    // bumped slightly because building all alarm state takes a few hundred
    // ms and we want consistent latency.
    const updaterFn = new nodejs.NodejsFunction(this, 'UpdateStatusPage', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      entry: path.join(
        __dirname,
        '..',
        '..',
        'src',
        'functions',
        'scheduled',
        'update-status-page.ts'
      ),
      functionName: `${this.stackName}-UpdateStatusPage`,
      logRetention: logs.RetentionDays.THREE_MONTHS,
      environment: {
        STATUS_BUCKET: bucket.bucketName,
        DISTRIBUTION_ID: distribution.distributionId,
        ALARM_NAME_PREFIX: alarmNamePrefix,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // S3 write to the status bucket only
    bucket.grantPut(updaterFn);
    bucket.grantPutAcl(updaterFn);

    // CloudWatch + CloudFront permissions
    updaterFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cloudwatch:DescribeAlarms',
          'cloudfront:CreateInvalidation',
        ],
        // DescribeAlarms requires '*' resource scope; CreateInvalidation
        // is scoped to the specific distribution but * keeps the policy
        // statement simple (no different security implications since the
        // Lambda only invalidates one distribution it knows about).
        resources: ['*'],
      })
    );

    // ─── Trigger 1: SNS subscription ───
    // Every alarm state change (OK ↔ ALARM) re-renders the page. The Lambda
    // ignores the SNS message body and re-reads current state.
    alertsTopic.addSubscription(new snsSubs.LambdaSubscription(updaterFn));

    // ─── Trigger 2: Daily cron ───
    // Keeps the "as of" timestamp fresh even when nothing changed. Also
    // self-heals if an alarm fires while the Lambda is broken or the
    // SNS subscription is misconfigured.
    // This stack's own rule DLQ — each stack owns its own (an EventBridge
    // DLQ's queue policy must reference the consuming rule ARNs, so sharing
    // Pipeline's queue creates a cyclic cross-stack dependency). The alarm
    // lives here too, wired to the alerts topic this stack already receives.
    const cronDlq = new sqs.Queue(this, 'StatusPageCronDlq', {
      queueName: `${this.stackName}-CronDlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });
    const cronDlqAlarm = new cloudwatch.Alarm(this, 'StatusPageCronDlqAlarm', {
      alarmName: `${this.stackName}-CronDlqMessages`,
      metric: cronDlq.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
        statistic: 'Maximum',
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cronDlqAlarm.addAlarmAction(new cwActions.SnsAction(alertsTopic));

    new events.Rule(this, 'StatusPageDailyCron', {
      ruleName: `${this.stackName}-StatusPageDailyCron`,
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }), // midnight UTC
      targets: [
        new targets.LambdaFunction(updaterFn, {
          deadLetterQueue: cronDlq,
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(1),
        }),
      ],
    });

    // ─── Outputs ───
    new cdk.CfnOutput(this, 'StatusPageUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description:
        'Public CloudFront URL for the status page. Add a CNAME from status.<your-domain> for a custom URL.',
    });
    new cdk.CfnOutput(this, 'StatusBucketName', { value: bucket.bucketName });
  }
}
