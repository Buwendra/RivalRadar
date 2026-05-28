import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { SharedRouteProps, routeContext, addRoute } from './route-factory';

export interface CoreRoutesStackProps extends cdk.NestedStackProps, SharedRouteProps {
  /** For the onboarding handler to kick off the research pipeline. */
  researchStateMachine: sfn.StateMachine;
  /** For the account-delete handler's `cognito-idp:AdminDeleteUser` grant. */
  userPool: cognito.IUserPool;
}

/**
 * Auth, user lifecycle, workspaces/teams, and API-key management routes.
 * One of four route-group nested stacks under {@link ApiStack}, split out to
 * keep each CloudFormation stack under the 500-resource hard limit.
 */
export class CoreRoutesStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: CoreRoutesStackProps) {
    super(scope, id, props);

    const ctx = routeContext(this, props);
    const { HttpMethod } = apigatewayv2;
    const pipelineEnv = { RESEARCH_PIPELINE_ARN: props.researchStateMachine.stateMachineArn };

    // ─── Auth Routes (public) ───
    addRoute(ctx, 'AuthSignup', HttpMethod.POST, '/auth/signup', 'api/auth/signup.ts', false);
    addRoute(ctx, 'AuthSignin', HttpMethod.POST, '/auth/signin', 'api/auth/signin.ts', false);
    addRoute(ctx, 'AuthResendVerification', HttpMethod.POST, '/auth/resend-verification', 'api/auth/resend-verification.ts', false);

    // ─── User Routes ───
    addRoute(ctx, 'UserProfile', HttpMethod.GET, '/users/me', 'api/users/profile.ts');
    addRoute(ctx, 'UserUpdate', HttpMethod.PUT, '/users/me', 'api/users/profile.ts');
    // Phase 8a — once-per-session login ping for the retention-nudge cron
    addRoute(ctx, 'UserPing', HttpMethod.POST, '/users/me/ping', 'api/users/ping.ts');
    // Phase 9a — GDPR Art. 18 self-suspend + re-consent
    addRoute(ctx, 'UserSuspend', HttpMethod.POST, '/users/me/suspend', 'api/users/suspend.ts');
    addRoute(ctx, 'UserResume', HttpMethod.POST, '/users/me/resume', 'api/users/suspend.ts');
    addRoute(ctx, 'UserAcceptTos', HttpMethod.POST, '/users/me/accept-tos', 'api/users/accept-tos.ts');
    const onboardFn = addRoute(ctx, 'UserOnboard', HttpMethod.POST, '/users/onboard', 'api/users/onboard.ts', true, pipelineEnv);
    props.researchStateMachine.grantStartExecution(onboardFn);

    // GDPR Art. 15+20 / CCPA §1798.110 — data export
    addRoute(ctx, 'UserExport', HttpMethod.GET, '/users/me/export', 'api/users/export.ts');

    // GDPR Art. 17 / CCPA §1798.105 — account deletion (right to erasure).
    // Lambda needs cognito:AdminDeleteUser to invalidate the auth identity.
    const userDeleteFn = addRoute(ctx, 'UserDelete', HttpMethod.DELETE, '/users/me', 'api/users/delete.ts');
    userDeleteFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['cognito-idp:AdminDeleteUser'],
        resources: [props.userPool.userPoolArn],
      })
    );

    // ─── Workspaces (Phase 4a) ───
    addRoute(ctx, 'WorkspacesList', HttpMethod.GET, '/workspaces', 'api/workspaces/list.ts');
    addRoute(ctx, 'WorkspaceMembersList', HttpMethod.GET, '/workspaces/current/members', 'api/workspaces/members.ts');
    addRoute(ctx, 'WorkspaceMemberRemove', HttpMethod.DELETE, '/workspaces/current/members/{userId}', 'api/workspaces/members.ts');
    // Phase 14 — role change (member ↔ admin), owner-only
    addRoute(ctx, 'WorkspaceMemberRoleChange', HttpMethod.PATCH, '/workspaces/current/members/{userId}', 'api/workspaces/members.ts');
    addRoute(ctx, 'WorkspaceInvite', HttpMethod.POST, '/workspaces/current/invitations', 'api/workspaces/invite.ts');
    addRoute(ctx, 'InvitationAccept', HttpMethod.POST, '/invitations/{token}/accept', 'api/workspaces/accept-invitation.ts');

    // ─── Workspace governance (Phase 4b) ───
    addRoute(ctx, 'WorkspaceUpdate', HttpMethod.PATCH, '/workspaces/current', 'api/workspaces/update.ts');
    addRoute(ctx, 'WorkspaceDelete', HttpMethod.DELETE, '/workspaces/current', 'api/workspaces/delete.ts');
    addRoute(ctx, 'WorkspaceAudit', HttpMethod.GET, '/workspaces/current/audit', 'api/workspaces/audit.ts');

    // ─── Ownership transfer (Phase 4c) ───
    addRoute(ctx, 'WorkspaceTransfer', HttpMethod.POST, '/workspaces/current/transfer-ownership', 'api/workspaces/transfer-ownership.ts');

    // ─── API Keys management (Phase 11) ───
    addRoute(ctx, 'ApiKeysCreate', HttpMethod.POST, '/workspaces/current/api-keys', 'api/api-keys/create.ts');
    addRoute(ctx, 'ApiKeysList', HttpMethod.GET, '/workspaces/current/api-keys', 'api/api-keys/list.ts');
    addRoute(ctx, 'ApiKeysDelete', HttpMethod.DELETE, '/workspaces/current/api-keys/{id}', 'api/api-keys/delete.ts');
  }
}
