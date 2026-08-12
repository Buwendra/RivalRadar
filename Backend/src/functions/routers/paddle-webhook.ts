import { makeRouter, RouteTable } from './_router';
import { handler as paddle } from '../api/webhooks/paddle';

// Solo function: public, signature-verified against the RAW request body.
// paddle.ts is apiHandler-wrapped, but the verification reads event.body
// untouched — neither the router nor apiHandler may ever parse or
// re-serialize it.
export const routes: RouteTable = {
  'POST /webhooks/paddle': paddle,
};

export const handler = makeRouter(routes);
