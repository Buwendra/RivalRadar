import { makeRouter, RouteTable } from './_router';
import { handler as refresh } from '../api/auth/refresh';

export const routes: RouteTable = {
  'POST /auth/refresh': refresh,
};

export const handler = makeRouter(routes);
