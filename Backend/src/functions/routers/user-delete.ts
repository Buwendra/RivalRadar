import { makeRouter, RouteTable } from './_router';
import { handler as userDelete } from '../api/users/delete';

export const routes: RouteTable = {
  'DELETE /users/me': userDelete,
};

export const handler = makeRouter(routes);
