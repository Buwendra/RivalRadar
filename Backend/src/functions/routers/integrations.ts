import { makeRouter, RouteTable } from './_router';
import { handler as list } from '../api/integrations/list';
import { handler as set } from '../api/integrations/set';
import { handler as test } from '../api/integrations/test';
import { handler as integrationsDelete } from '../api/integrations/delete';

export const routes: RouteTable = {
  'GET /integrations': list,
  'POST /integrations': set,
  'POST /integrations/{provider}/test': test,
  'DELETE /integrations/{provider}': integrationsDelete,
};

export const handler = makeRouter(routes);
