import { makeRouter, RouteTable } from './_router';
import { handler as profile } from '../api/users/profile';
import { handler as ping } from '../api/users/ping';
import { handler as suspend } from '../api/users/suspend';
import { handler as acceptTos } from '../api/users/accept-tos';
import { handler as userExport } from '../api/users/export';

export const routes: RouteTable = {
  // profile.ts dispatches GET vs PUT internally
  'GET /users/me': profile,
  'PUT /users/me': profile,
  'POST /users/me/ping': ping,
  // suspend.ts dispatches suspend vs resume internally (path.endsWith)
  'POST /users/me/suspend': suspend,
  'POST /users/me/resume': suspend,
  'POST /users/me/accept-tos': acceptTos,
  'GET /users/me/export': userExport,
};

export const handler = makeRouter(routes);
