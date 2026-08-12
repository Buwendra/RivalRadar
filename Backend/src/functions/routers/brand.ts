import { makeRouter, RouteTable } from './_router';
import { handler as get } from '../api/brand/get';
import { handler as coverage } from '../api/brand/coverage';
import { handler as sentiment } from '../api/brand/sentiment';
import { handler as health } from '../api/brand/health';
import { handler as shareOfVoice } from '../api/analytics/share-of-voice';

// POST /brand/research and /brand/setup live in ResearchTriggers (they start
// the paid research pipeline and need its StartExecution grant).
export const routes: RouteTable = {
  'GET /brand': get,
  'GET /brand/coverage': coverage,
  'GET /brand/sentiment': sentiment,
  'GET /brand/health': health,
  'GET /analytics/share-of-voice': shareOfVoice,
};

export const handler = makeRouter(routes);
