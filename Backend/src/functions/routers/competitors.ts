import { makeRouter, RouteTable } from './_router';
import { handler as list } from '../api/competitors/list';
import { handler as create } from '../api/competitors/create';
import { handler as bulkImport } from '../api/competitors/bulk-import';
import { handler as matrix } from '../api/competitors/matrix';
import { handler as get } from '../api/competitors/get';
import { handler as competitorDelete } from '../api/competitors/delete';
import { handler as snooze } from '../api/competitors/snooze';
import { handler as battlecardsList } from '../api/battlecards/list';
import { handler as battlecardsDelete } from '../api/battlecards/delete';
import { handler as exportsCsv } from '../api/exports/csv';

export const routes: RouteTable = {
  'GET /competitors': list,
  'POST /competitors': create,
  'POST /competitors/bulk-import': bulkImport,
  'GET /competitors/matrix': matrix,
  'GET /competitors/{id}': get,
  'DELETE /competitors/{id}': competitorDelete,
  'PATCH /competitors/{id}/snooze': snooze,
  'GET /battlecards': battlecardsList,
  'DELETE /battlecards/{id}': battlecardsDelete,
  'POST /exports/csv': exportsCsv,
};

export const handler = makeRouter(routes);
