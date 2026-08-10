import { makeRouter, RouteTable } from './_router';
import { handler as competitorsList } from '../api/v1/competitors';
import { handler as changesList } from '../api/v1/changes';
import { handler as recommendationsList } from '../api/v1/recommendations';
import { handler as competitorsCreate } from '../api/v1/competitors-create';
import { handler as competitorsSnooze } from '../api/v1/competitors-snooze';
import { handler as recommendationsUpdate } from '../api/v1/recommendations-update';

// Public API — X-API-Key auth happens in-handler (resolveApiKeyContext), so
// these routes have no Cognito authorizer at the gateway.
export const routes: RouteTable = {
  'GET /v1/competitors': competitorsList,
  'GET /v1/changes': changesList,
  'GET /v1/recommendations': recommendationsList,
  'POST /v1/competitors': competitorsCreate,
  'PATCH /v1/competitors/{id}/snooze': competitorsSnooze,
  'PATCH /v1/recommendations/{id}': recommendationsUpdate,
};

export const handler = makeRouter(routes);
