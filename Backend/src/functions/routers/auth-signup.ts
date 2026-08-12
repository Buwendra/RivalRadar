import { makeRouter, RouteTable } from './_router';
import { handler as signup } from '../api/auth/signup';

export const routes: RouteTable = {
  'POST /auth/signup': signup,
};

export const handler = makeRouter(routes);
