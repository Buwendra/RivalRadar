/**
 * Shared factory for the domain-function routers.
 *
 * Contract (load-bearing — see route-manifest.ts and CLAUDE.md):
 *  - Dispatch on the EXACT `event.routeKey` string ("METHOD /path" exactly as
 *    registered at the gateway). Never parse paths: several handler modules
 *    (users/profile.ts, users/suspend.ts) were written under the guarantee
 *    that the gateway only delivers them their own routes, and sibling routes
 *    like /competitors/matrix vs /competitors/{id} only stay unambiguous
 *    because API Gateway resolves specificity before we ever run.
 *  - Pass (event, context) through UNTOUCHED and return the result VERBATIM.
 *    No body parsing, no CORS injection, no response re-wrapping — handlers
 *    own their envelopes (apiHandler), and two of them deliberately don't use
 *    it at all (public/battlecard.ts emits a raw 302 + Location; paddle.ts
 *    verifies a signature against the raw body bytes).
 *  - Unknown routeKey → 404 ROUTE_NOT_FOUND. The gateway answers OPTIONS
 *    preflights itself (corsPreflight), so routers never see OPTIONS; an
 *    unknown key here means manifest/router drift (test-guarded) or a direct
 *    invoke with a synthetic event.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';

/** Permissive by design: member handlers are typed against AuthenticatedEvent
 *  or PublicEvent; the router is transport-only and must not care. */
export type RouteHandler = (
  event: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  context: Context
) => Promise<APIGatewayProxyResultV2>;

export type RouteTable = Record<string, RouteHandler>;

export function makeRouter(routes: RouteTable) {
  return async (
    event: APIGatewayProxyEventV2,
    context: Context
  ): Promise<APIGatewayProxyResultV2> => {
    const route = routes[event.routeKey];
    if (!route) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { code: 'ROUTE_NOT_FOUND', message: `No handler for ${event.routeKey}` },
        }),
      };
    }
    return route(event, context);
  };
}
