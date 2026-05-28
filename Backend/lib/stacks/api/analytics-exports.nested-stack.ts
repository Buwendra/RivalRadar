import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { SharedRouteProps, routeContext, addRoute, addPdfRoute } from './route-factory';

export type AnalyticsExportsRoutesStackProps = cdk.NestedStackProps & SharedRouteProps;

/**
 * Comparative analytics, changes, recommendations, notifications, saved views,
 * search, onboarding suggestions, and exports (CSV + PDF). One of four
 * route-group nested stacks under {@link ApiStack}.
 */
export class AnalyticsExportsRoutesStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: AnalyticsExportsRoutesStackProps) {
    super(scope, id, props);

    const ctx = routeContext(this, props);
    const { HttpMethod } = apigatewayv2;

    // Phase 24 — Share of Voice comparative analytics.
    addRoute(ctx, 'AnalyticsShareOfVoice', HttpMethod.GET, '/analytics/share-of-voice', 'api/analytics/share-of-voice.ts');

    // ─── Changes Routes ───
    addRoute(ctx, 'ChangesList', HttpMethod.GET, '/changes', 'api/changes/list.ts');
    addRoute(ctx, 'ChangesGet', HttpMethod.GET, '/changes/{id}', 'api/changes/get.ts');
    addRoute(ctx, 'ChangesFeedback', HttpMethod.POST, '/changes/{id}/feedback', 'api/changes/feedback.ts');
    // Phase 7a — change notes (single handler dispatches GET vs POST internally)
    addRoute(ctx, 'ChangesNotesList', HttpMethod.GET, '/changes/{id}/notes', 'api/changes/notes.ts');
    addRoute(ctx, 'ChangesNotesCreate', HttpMethod.POST, '/changes/{id}/notes', 'api/changes/notes.ts');

    // ─── Recommendations Routes (Phase 2) ───
    addRoute(ctx, 'RecommendationsList', HttpMethod.GET, '/recommendations', 'api/recommendations/list.ts');
    addRoute(ctx, 'RecommendationsUpdate', HttpMethod.PATCH, '/recommendations/{id}', 'api/recommendations/update-status.ts');

    // ─── Notifications (Phase 18) — caller-scoped in-app inbox ───
    addRoute(ctx, 'NotificationsList', HttpMethod.GET, '/notifications', 'api/notifications/list.ts');
    addRoute(ctx, 'NotificationsMarkRead', HttpMethod.PATCH, '/notifications/{id}/read', 'api/notifications/mark-read.ts');
    addRoute(ctx, 'NotificationsMarkAllRead', HttpMethod.POST, '/notifications/mark-all-read', 'api/notifications/mark-all-read.ts');

    // ─── Saved Views (Phase 7b) ───
    addRoute(ctx, 'SavedViewsList', HttpMethod.GET, '/saved-views', 'api/saved-views/list.ts');
    addRoute(ctx, 'SavedViewsCreate', HttpMethod.POST, '/saved-views', 'api/saved-views/create.ts');
    addRoute(ctx, 'SavedViewsUpdate', HttpMethod.PATCH, '/saved-views/{id}', 'api/saved-views/update.ts');
    addRoute(ctx, 'SavedViewsDelete', HttpMethod.DELETE, '/saved-views/{id}', 'api/saved-views/delete.ts');
    // Phase 15 — saved-view email subscriptions (per-caller, weekly cadence)
    addRoute(ctx, 'SavedViewsSubscribe', HttpMethod.POST, '/saved-views/{id}/subscribe', 'api/saved-views/subscribe.ts');
    addRoute(ctx, 'SavedViewsUnsubscribe', HttpMethod.DELETE, '/saved-views/{id}/subscribe', 'api/saved-views/unsubscribe.ts');

    // ─── Search (Phase 7b) ───
    addRoute(ctx, 'Search', HttpMethod.GET, '/search', 'api/search/search.ts');

    // ─── Onboarding Routes (Phase 5) ───
    addRoute(ctx, 'OnboardingSuggestCompetitors', HttpMethod.POST, '/onboarding/suggest-competitors', 'api/onboarding/suggest-competitors.ts');

    // ─── Exports Routes (Phase 6a + 6b) ───
    addRoute(ctx, 'ExportsCsv', HttpMethod.POST, '/exports/csv', 'api/exports/csv.ts');
    // PDF weekly briefing — PDFKit needs more memory + a longer timeout.
    addPdfRoute(ctx, 'ExportsPdf', '/exports/pdf', 'api/exports/pdf.ts');
  }
}
