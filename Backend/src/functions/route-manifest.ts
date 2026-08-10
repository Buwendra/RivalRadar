/**
 * Route manifest — the single source of truth for the API's route table.
 *
 * Consumed by:
 *  - `lib/stacks/api.stack.ts` (relative import — ts-node synth has no path
 *    aliases): generates the domain Lambda functions and gateway routes.
 *  - `src/functions/routers/router-manifest.test.ts`: asserts every router's
 *    dispatch table matches this manifest exactly.
 *  - `lib/stacks/api.stack.test.ts`: asserts the synthesized template matches
 *    this manifest exactly.
 *
 * Deliberately a zero-import leaf module (pure types + data) so the stack can
 * import it without dragging runtime code into synth, and routers never import
 * it at all (they declare their routeKeys literally; the consistency test is
 * what keeps the two in agreement).
 *
 * Adding a route = one row here + one entry in the owning router's table.
 * Adding a function = one FNS entry + a router file; pick the owning function
 * by PRIVILEGE and PACKAGING, not URL path: routes with elevated IAM or
 * special bundling stay in dedicated functions, and public (non-Cognito)
 * routes never share a function with elevated grants.
 */

export type FnId =
  | 'AuthSignup'
  | 'AuthSignin'
  | 'AuthRefresh'
  | 'Users'
  | 'UserDelete'
  | 'ResearchTriggers'
  | 'ResearchRuns'
  | 'ResearchRunsDetails'
  | 'Competitors'
  | 'Brand'
  | 'Changes'
  | 'Workspaces'
  | 'Views'
  | 'Integrations'
  | 'Subscriptions'
  | 'PaddleWebhook'
  | 'PublicShare'
  | 'V1'
  | 'Pdf'
  | 'Admin';

export type HttpMethodStr = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** HTTP API v2 routeKey format: `"METHOD /path"` — delivered verbatim on
 *  `event.routeKey`, and exactly what the routers dispatch on. */
export type RouteKey = `${HttpMethodStr} /${string}`;

export interface RouteDef {
  routeKey: RouteKey;
  /** 'jwt' = Cognito authorizer at the gateway; 'public' = no authorizer
   *  (handler self-authenticates: X-API-Key, share token, webhook signature,
   *  or is genuinely public like the auth endpoints). */
  auth: 'jwt' | 'public';
  fn: FnId;
}

/** Semantic grant markers — api.stack.ts maps these to concrete IAM. Every
 *  function also gets the baseline: table RW + bucket RW + secrets read. */
export type GrantMarker =
  | 'startResearchExecution' // researchStateMachine.grantStartExecution
  | 'adminDeleteUser' // cognito-idp:AdminDeleteUser on the user pool
  | 'sfnReadExecution' // states:Get/DescribeExecution + deep-research logs:FilterLogEvents
  | 'sesSend'; // ses:SendEmail/SendRawEmail (mirrors pipeline.stack.ts)

/** Env markers — api.stack.ts resolves these to values (process.env reads or
 *  construct references). */
export type EnvMarker =
  | 'signupFlag' // SIGNUP_ENABLED
  | 'paddlePrices' // PADDLE_PRICE_SCOUT / _STRATEGIST / _COMMAND
  | 'adminEmails' // ADMIN_EMAILS
  | 'researchPipelineArn' // RESEARCH_PIPELINE_ARN
  | 'deepResearchLambdaName'; // DEEP_RESEARCH_LAMBDA_NAME

export interface FnDef {
  /** Router entry file, relative to src/functions/. */
  entry: string;
  /** Default 256. */
  memoryMb?: number;
  /** Default 30. */
  timeoutSec?: number;
  /** PDFKit .afm font-metrics afterBundling copy hook (Pdf only). */
  pdfFonts?: boolean;
  env?: readonly EnvMarker[];
  grants?: readonly GrantMarker[];
}

export const FNS: Record<FnId, FnDef> = {
  // Solo — preserves the reserved-concurrency-0 kill switch without touching
  // signin/refresh (see docs/runbooks/INCIDENT_RUNBOOK.md).
  AuthSignup: { entry: 'routers/auth-signup.ts', env: ['signupFlag'] },
  // Abuse-facing credential ops, throttleable together.
  AuthSignin: { entry: 'routers/auth-signin.ts' },
  // Solo — the session lifeline must survive a credential-endpoint throttle,
  // or every signed-in user is locked out within ~1h as id tokens expire.
  AuthRefresh: { entry: 'routers/auth-refresh.ts' },
  Users: { entry: 'routers/users.ts' },
  // Solo — the single most destructive grant stays on a single-route role.
  UserDelete: { entry: 'routers/user-delete.ts', grants: ['adminDeleteUser', 'sesSend'] },
  // The four routes that can start a paid research run — one kill point, one
  // StartExecution grant.
  ResearchTriggers: {
    entry: 'routers/research-triggers.ts',
    env: ['researchPipelineArn'],
    grants: ['startResearchExecution'],
  },
  ResearchRuns: { entry: 'routers/research-runs.ts' },
  // Solo — reads SFN execution history + the deep-research Lambda's logs.
  ResearchRunsDetails: {
    entry: 'routers/research-runs-details.ts',
    env: ['deepResearchLambdaName'],
    grants: ['sfnReadExecution'],
  },
  Competitors: { entry: 'routers/competitors.ts' },
  Brand: { entry: 'routers/brand.ts' },
  Changes: { entry: 'routers/changes.ts' },
  Workspaces: { entry: 'routers/workspaces.ts', grants: ['sesSend'] },
  Views: { entry: 'routers/views.ts' },
  Integrations: { entry: 'routers/integrations.ts' },
  // checkout.ts freezes PADDLE_PRICE_* into module scope at import time — the
  // env marker is mandatory, not cosmetic.
  Subscriptions: { entry: 'routers/subscriptions.ts', env: ['paddlePrices'] },
  // Solo — public, raw-body signature-verified, revenue-critical.
  PaddleWebhook: { entry: 'routers/paddle-webhook.ts', grants: ['sesSend'] },
  // Public token-validated share routes; zero elevated IAM by design.
  PublicShare: { entry: 'routers/public-share.ts' },
  // X-API-Key routes (public at the gateway, self-auth in-handler).
  V1: { entry: 'routers/v1.ts' },
  // PDFKit needs 1024 MB, a 60s timeout, and the .afm font assets copied into
  // the bundle (see AFM hook in api.stack.ts) — never merge these two routes
  // into a 256 MB domain function.
  Pdf: { entry: 'routers/pdf.ts', memoryMb: 1024, timeoutSec: 60, pdfFonts: true },
  Admin: { entry: 'routers/admin.ts', env: ['adminEmails'] },
};

/**
 * All 84 routes. Rows are grouped per fn and the per-fn order is load-bearing
 * for CloudFormation logical IDs: the fn's Integration construct is parented
 * under the FIRST route bound to it, so reordering rows within a group
 * replaces the integration on the next deploy (harmless — stateless — but
 * noisy). Keep new routes at the END of their fn's group.
 */
export const ROUTES: readonly RouteDef[] = [
  // ─── AuthSignup ───
  { routeKey: 'POST /auth/signup', auth: 'public', fn: 'AuthSignup' },

  // ─── AuthSignin ───
  { routeKey: 'POST /auth/signin', auth: 'public', fn: 'AuthSignin' },
  { routeKey: 'POST /auth/resend-verification', auth: 'public', fn: 'AuthSignin' },

  // ─── AuthRefresh ─── (public by necessity: caller's id token is expired)
  { routeKey: 'POST /auth/refresh', auth: 'public', fn: 'AuthRefresh' },

  // ─── Users ───
  { routeKey: 'GET /users/me', auth: 'jwt', fn: 'Users' },
  { routeKey: 'PUT /users/me', auth: 'jwt', fn: 'Users' },
  { routeKey: 'POST /users/me/ping', auth: 'jwt', fn: 'Users' },
  { routeKey: 'POST /users/me/suspend', auth: 'jwt', fn: 'Users' },
  { routeKey: 'POST /users/me/resume', auth: 'jwt', fn: 'Users' },
  { routeKey: 'POST /users/me/accept-tos', auth: 'jwt', fn: 'Users' },
  { routeKey: 'GET /users/me/export', auth: 'jwt', fn: 'Users' },

  // ─── UserDelete ───
  { routeKey: 'DELETE /users/me', auth: 'jwt', fn: 'UserDelete' },

  // ─── ResearchTriggers ─── (brand/setup seeds the self-brand row AND kicks
  // research — it lives here for the StartExecution grant, not under Brand)
  { routeKey: 'POST /users/onboard', auth: 'jwt', fn: 'ResearchTriggers' },
  { routeKey: 'POST /competitors/{id}/research', auth: 'jwt', fn: 'ResearchTriggers' },
  { routeKey: 'POST /brand/research', auth: 'jwt', fn: 'ResearchTriggers' },
  { routeKey: 'POST /brand/setup', auth: 'jwt', fn: 'ResearchTriggers' },

  // ─── ResearchRuns ───
  { routeKey: 'GET /research-runs', auth: 'jwt', fn: 'ResearchRuns' },
  { routeKey: 'GET /research-runs/{id}', auth: 'jwt', fn: 'ResearchRuns' },

  // ─── ResearchRunsDetails ───
  { routeKey: 'GET /research-runs/{id}/details', auth: 'jwt', fn: 'ResearchRunsDetails' },

  // ─── Competitors ───
  { routeKey: 'GET /competitors', auth: 'jwt', fn: 'Competitors' },
  { routeKey: 'POST /competitors', auth: 'jwt', fn: 'Competitors' },
  { routeKey: 'POST /competitors/bulk-import', auth: 'jwt', fn: 'Competitors' },
  { routeKey: 'GET /competitors/matrix', auth: 'jwt', fn: 'Competitors' },
  { routeKey: 'GET /competitors/{id}', auth: 'jwt', fn: 'Competitors' },
  { routeKey: 'DELETE /competitors/{id}', auth: 'jwt', fn: 'Competitors' },
  { routeKey: 'PATCH /competitors/{id}/snooze', auth: 'jwt', fn: 'Competitors' },
  { routeKey: 'GET /battlecards', auth: 'jwt', fn: 'Competitors' },
  { routeKey: 'DELETE /battlecards/{id}', auth: 'jwt', fn: 'Competitors' },
  { routeKey: 'POST /exports/csv', auth: 'jwt', fn: 'Competitors' },

  // ─── Brand ───
  { routeKey: 'GET /brand', auth: 'jwt', fn: 'Brand' },
  { routeKey: 'GET /brand/coverage', auth: 'jwt', fn: 'Brand' },
  { routeKey: 'GET /brand/sentiment', auth: 'jwt', fn: 'Brand' },
  { routeKey: 'GET /brand/health', auth: 'jwt', fn: 'Brand' },
  { routeKey: 'GET /analytics/share-of-voice', auth: 'jwt', fn: 'Brand' },

  // ─── Changes ───
  { routeKey: 'GET /changes', auth: 'jwt', fn: 'Changes' },
  { routeKey: 'GET /changes/{id}', auth: 'jwt', fn: 'Changes' },
  { routeKey: 'POST /changes/{id}/feedback', auth: 'jwt', fn: 'Changes' },
  { routeKey: 'GET /changes/{id}/notes', auth: 'jwt', fn: 'Changes' },
  { routeKey: 'POST /changes/{id}/notes', auth: 'jwt', fn: 'Changes' },
  { routeKey: 'GET /recommendations', auth: 'jwt', fn: 'Changes' },
  { routeKey: 'PATCH /recommendations/{id}', auth: 'jwt', fn: 'Changes' },

  // ─── Workspaces ───
  { routeKey: 'GET /workspaces', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'GET /workspaces/current/members', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'DELETE /workspaces/current/members/{userId}', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'PATCH /workspaces/current/members/{userId}', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'POST /workspaces/current/invitations', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'POST /invitations/{token}/accept', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'PATCH /workspaces/current', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'DELETE /workspaces/current', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'GET /workspaces/current/audit', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'POST /workspaces/current/transfer-ownership', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'POST /workspaces/current/api-keys', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'GET /workspaces/current/api-keys', auth: 'jwt', fn: 'Workspaces' },
  { routeKey: 'DELETE /workspaces/current/api-keys/{id}', auth: 'jwt', fn: 'Workspaces' },

  // ─── Views ─── (saved views + search + onboarding suggestions + notifications)
  { routeKey: 'GET /saved-views', auth: 'jwt', fn: 'Views' },
  { routeKey: 'POST /saved-views', auth: 'jwt', fn: 'Views' },
  { routeKey: 'PATCH /saved-views/{id}', auth: 'jwt', fn: 'Views' },
  { routeKey: 'DELETE /saved-views/{id}', auth: 'jwt', fn: 'Views' },
  { routeKey: 'POST /saved-views/{id}/subscribe', auth: 'jwt', fn: 'Views' },
  { routeKey: 'DELETE /saved-views/{id}/subscribe', auth: 'jwt', fn: 'Views' },
  { routeKey: 'GET /search', auth: 'jwt', fn: 'Views' },
  { routeKey: 'POST /onboarding/suggest-competitors', auth: 'jwt', fn: 'Views' },
  { routeKey: 'GET /notifications', auth: 'jwt', fn: 'Views' },
  { routeKey: 'PATCH /notifications/{id}/read', auth: 'jwt', fn: 'Views' },
  { routeKey: 'POST /notifications/mark-all-read', auth: 'jwt', fn: 'Views' },

  // ─── Integrations ───
  { routeKey: 'GET /integrations', auth: 'jwt', fn: 'Integrations' },
  { routeKey: 'POST /integrations', auth: 'jwt', fn: 'Integrations' },
  { routeKey: 'POST /integrations/{provider}/test', auth: 'jwt', fn: 'Integrations' },
  { routeKey: 'DELETE /integrations/{provider}', auth: 'jwt', fn: 'Integrations' },

  // ─── Subscriptions ───
  { routeKey: 'GET /subscriptions/me', auth: 'jwt', fn: 'Subscriptions' },
  { routeKey: 'POST /subscriptions/checkout', auth: 'jwt', fn: 'Subscriptions' },
  { routeKey: 'POST /subscriptions/portal', auth: 'jwt', fn: 'Subscriptions' },

  // ─── PaddleWebhook ───
  { routeKey: 'POST /webhooks/paddle', auth: 'public', fn: 'PaddleWebhook' },

  // ─── PublicShare ───
  { routeKey: 'GET /public/battlecards/{token}', auth: 'public', fn: 'PublicShare' },
  { routeKey: 'POST /cancellation-feedback/{token}', auth: 'public', fn: 'PublicShare' },

  // ─── V1 ───
  { routeKey: 'GET /v1/competitors', auth: 'public', fn: 'V1' },
  { routeKey: 'GET /v1/changes', auth: 'public', fn: 'V1' },
  { routeKey: 'GET /v1/recommendations', auth: 'public', fn: 'V1' },
  { routeKey: 'POST /v1/competitors', auth: 'public', fn: 'V1' },
  { routeKey: 'PATCH /v1/competitors/{id}/snooze', auth: 'public', fn: 'V1' },
  { routeKey: 'PATCH /v1/recommendations/{id}', auth: 'public', fn: 'V1' },

  // ─── Pdf ───
  { routeKey: 'POST /exports/pdf', auth: 'jwt', fn: 'Pdf' },
  { routeKey: 'POST /competitors/{id}/battlecard', auth: 'jwt', fn: 'Pdf' },

  // ─── Admin ───
  { routeKey: 'GET /admin/business', auth: 'jwt', fn: 'Admin' },
];
