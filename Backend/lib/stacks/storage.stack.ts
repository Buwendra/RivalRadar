import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly snapshotBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.snapshotBucket = new s3.Bucket(this, 'SnapshotBucket', {
      bucketName: `${this.stackName.toLowerCase()}-snapshots`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          // Move old snapshots to Infrequent Access after 90 days
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          // Delete snapshots older than 1 year
          expiration: cdk.Duration.days(365),
        },
      ],
    });

    new cdk.CfnOutput(this, 'BucketName', { value: this.snapshotBucket.bucketName });
  }
}
