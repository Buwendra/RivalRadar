import { makeRouter, RouteTable } from './_router';
import { handler as onboard } from '../api/users/onboard';
import { handler as competitorResearch } from '../api/competitors/research';
import { handler as brandResearch } from '../api/brand/research';
import { handler as brandSetup } from '../api/brand/setup';

// The four routes that can start a paid research run (states:StartExecution).
export const routes: RouteTable = {
  'POST /users/onboard': onboard,
  'POST /competitors/{id}/research': competitorResearch,
  'POST /brand/research': brandResearch,
  'POST /brand/setup': brandSetup,
};

export const handler = makeRouter(routes);
