import { makeRouter, RouteTable } from './_router';
import { handler as list } from '../api/changes/list';
import { handler as get } from '../api/changes/get';
import { handler as feedback } from '../api/changes/feedback';
import { handler as notes } from '../api/changes/notes';
import { handler as recommendationsList } from '../api/recommendations/list';
import { handler as recommendationsUpdate } from '../api/recommendations/update-status';

export const routes: RouteTable = {
  'GET /changes': list,
  'GET /changes/{id}': get,
  'POST /changes/{id}/feedback': feedback,
  // notes.ts dispatches GET vs POST internally
  'GET /changes/{id}/notes': notes,
  'POST /changes/{id}/notes': notes,
  'GET /recommendations': recommendationsList,
  'PATCH /recommendations/{id}': recommendationsUpdate,
};

export const handler = makeRouter(routes);
