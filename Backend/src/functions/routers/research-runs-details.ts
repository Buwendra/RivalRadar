import { makeRouter, RouteTable } from './_router';
import { handler as details } from '../api/research-runs/details';

export const routes: RouteTable = {
  'GET /research-runs/{id}/details': details,
};

export const handler = makeRouter(routes);
