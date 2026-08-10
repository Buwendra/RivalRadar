import { makeRouter, RouteTable } from './_router';
import { handler as business } from '../api/admin/business';

export const routes: RouteTable = {
  'GET /admin/business': business,
};

export const handler = makeRouter(routes);
