import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { SharedRouteProps, routeContext, addRoute } from './route-factory';

export type IntegrationRoutesStackProps = cdk.NestedStackProps & SharedRouteProps;

/**
 * Outbound integrations (Slack/webhook), Paddle subscriptions + webhook,
 * cancellation feedback, the owner-only admin snapshot, and the public
 * X-API-Key `/v1` API. One of four route-group nested stacks under
 * {@link ApiStack}.
 */
export class IntegrationRoutesStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: IntegrationRoutesStackProps) {
    super(scope, id, props);

    const ctx = routeContext(this, props);
    const { HttpMethod } = apigatewayv2;

    // ─── Integrations Routes (Phase 3) ───
    addRoute(ctx, 'IntegrationsList', HttpMethod.GET, '/integrations', 'api/integrations/list.ts');
    addRoute(ctx, 'IntegrationsSet', HttpMethod.POST, '/integrations', 'api/integrations/set.ts');
    addRoute(ctx, 'IntegrationsTest', HttpMethod.POST, '/integrations/{provider}/test', 'api/integrations/test.ts');
    addRoute(ctx, 'IntegrationsDelete', HttpMethod.DELETE, '/integrations/{provider}', 'api/integrations/delete.ts');

    // ─── Subscription Routes ───
    addRoute(ctx, 'SubCurrent', HttpMethod.GET, '/subscriptions/me', 'api/subscriptions/current.ts');
    addRoute(ctx, 'SubCheckout', HttpMethod.POST, '/subscriptions/checkout', 'api/subscriptions/checkout.ts', true, {
      PADDLE_PRICE_SCOUT: process.env.PADDLE_PRICE_SCOUT ?? '',
      PADDLE_PRICE_STRATEGIST: process.env.PADDLE_PRICE_STRATEGIST ?? '',
      PADDLE_PRICE_COMMAND: process.env.PADDLE_PRICE_COMMAND ?? '',
    });
    addRoute(ctx, 'SubPortal', HttpMethod.POST, '/subscriptions/portal', 'api/subscriptions/portal.ts');

    // ─── Webhook Routes (public, verified by signature) ───
    addRoute(ctx, 'PaddleWebhook', HttpMethod.POST, '/webhooks/paddle', 'api/webhooks/paddle.ts', false);

    // ─── Cancellation Feedback (Phase 8b — public, token-validated) ───
    addRoute(ctx, 'CancellationFeedbackSubmit', HttpMethod.POST, '/cancellation-feedback/{token}', 'api/cancellation/submit.ts', false);

    // ─── Admin Business Snapshot (Phase 8b — owner-only via ADMIN_EMAILS allowlist) ───
    addRoute(ctx, 'AdminBusiness', HttpMethod.GET, '/admin/business', 'api/admin/business.ts', true, {
      ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? '',
    });

    // ─── Public read API (Phase 11) — auth via X-API-Key, NOT Cognito ───
    addRoute(ctx, 'ApiV1CompetitorsList', HttpMethod.GET, '/v1/competitors', 'api/v1/competitors.ts', false);
    addRoute(ctx, 'ApiV1ChangesList', HttpMethod.GET, '/v1/changes', 'api/v1/changes.ts', false);
    addRoute(ctx, 'ApiV1RecommendationsList', HttpMethod.GET, '/v1/recommendations', 'api/v1/recommendations.ts', false);

    // ─── Public write API (Phase 13) — write-scope keys only ───
    addRoute(ctx, 'ApiV1CompetitorsCreate', HttpMethod.POST, '/v1/competitors', 'api/v1/competitors-create.ts', false);
    addRoute(ctx, 'ApiV1CompetitorsSnooze', HttpMethod.PATCH, '/v1/competitors/{id}/snooze', 'api/v1/competitors-snooze.ts', false);
    addRoute(ctx, 'ApiV1RecommendationsUpdate', HttpMethod.PATCH, '/v1/recommendations/{id}', 'api/v1/recommendations-update.ts', false);
  }
}
