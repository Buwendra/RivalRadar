import { makeRouter, RouteTable } from './_router';
import { handler as current } from '../api/subscriptions/current';
import { handler as checkout } from '../api/subscriptions/checkout';
import { handler as portal } from '../api/subscriptions/portal';

// checkout.ts reads PADDLE_PRICE_* at import time — this function's env must
// carry them (the 'paddlePrices' marker in route-manifest.ts).
export const routes: RouteTable = {
  'GET /subscriptions/me': current,
  'POST /subscriptions/checkout': checkout,
  'POST /subscriptions/portal': portal,
};

export const handler = makeRouter(routes);
