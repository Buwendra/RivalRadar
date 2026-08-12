import { makeRouter, RouteTable } from './_router';
import { handler as publicBattlecard } from '../api/public/battlecard';
import { handler as cancellationSubmit } from '../api/cancellation/submit';

// Public token-validated share routes. battlecard.ts is a RAW handler (no
// apiHandler) that emits a 302 + Location redirect — the router returns its
// result verbatim, which is why this works.
export const routes: RouteTable = {
  'GET /public/battlecards/{token}': publicBattlecard,
  'POST /cancellation-feedback/{token}': cancellationSubmit,
};

export const handler = makeRouter(routes);
