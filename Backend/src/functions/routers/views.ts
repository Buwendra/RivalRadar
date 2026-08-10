import { makeRouter, RouteTable } from './_router';
import { handler as savedViewsList } from '../api/saved-views/list';
import { handler as savedViewsCreate } from '../api/saved-views/create';
import { handler as savedViewsUpdate } from '../api/saved-views/update';
import { handler as savedViewsDelete } from '../api/saved-views/delete';
import { handler as savedViewsSubscribe } from '../api/saved-views/subscribe';
import { handler as savedViewsUnsubscribe } from '../api/saved-views/unsubscribe';
import { handler as search } from '../api/search/search';
import { handler as suggestCompetitors } from '../api/onboarding/suggest-competitors';
import { handler as notificationsList } from '../api/notifications/list';
import { handler as notificationsMarkRead } from '../api/notifications/mark-read';
import { handler as notificationsMarkAllRead } from '../api/notifications/mark-all-read';

export const routes: RouteTable = {
  'GET /saved-views': savedViewsList,
  'POST /saved-views': savedViewsCreate,
  'PATCH /saved-views/{id}': savedViewsUpdate,
  'DELETE /saved-views/{id}': savedViewsDelete,
  'POST /saved-views/{id}/subscribe': savedViewsSubscribe,
  'DELETE /saved-views/{id}/subscribe': savedViewsUnsubscribe,
  'GET /search': search,
  'POST /onboarding/suggest-competitors': suggestCompetitors,
  'GET /notifications': notificationsList,
  'PATCH /notifications/{id}/read': notificationsMarkRead,
  'POST /notifications/mark-all-read': notificationsMarkAllRead,
};

export const handler = makeRouter(routes);
