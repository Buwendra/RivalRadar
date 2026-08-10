import { makeRouter, RouteTable } from './_router';
import { handler as list } from '../api/research-runs/list';
import { handler as get } from '../api/research-runs/get';

export const routes: RouteTable = {
  'GET /research-runs': list,
  'GET /research-runs/{id}': get,
};

export const handler = makeRouter(routes);
