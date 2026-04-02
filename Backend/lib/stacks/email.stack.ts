import * as cdk from 'aws-cdk-lib';

import { Construct } from 'constructs';

export class EmailStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SES email identity — verify your domain or email in the AWS Console
    // For production, verify a domain. For dev, verify individual email addresses.
    // The actual identity is created via AWS Console or CLI since it requires DNS verification.

    new cdk.CfnOutput(this, 'Note', {
      value: 'Verify your sending domain/email in the SES console before sending emails.',
    });
  }
}
