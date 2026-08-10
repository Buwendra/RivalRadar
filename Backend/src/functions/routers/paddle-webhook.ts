import { makeRouter, RouteTable } from './_router';
import { handler as paddle } from '../api/webhooks/paddle';

// Solo function: public, signature-verified against the RAW request body —
// the router must never parse or re-serialize the event (it doesn't).
export const routes: RouteTable = {
  'POST /webhooks/paddle': paddle,
};

export const handler = makeRouter(routes);
