import { makeRouter, RouteTable } from './_router';
import { handler as signin } from '../api/auth/signin';
import { handler as resendVerification } from '../api/auth/resend-verification';

export const routes: RouteTable = {
  'POST /auth/signin': signin,
  'POST /auth/resend-verification': resendVerification,
};

export const handler = makeRouter(routes);
