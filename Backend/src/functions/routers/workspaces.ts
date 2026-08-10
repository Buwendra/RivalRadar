import { makeRouter, RouteTable } from './_router';
import { handler as list } from '../api/workspaces/list';
import { handler as members } from '../api/workspaces/members';
import { handler as invite } from '../api/workspaces/invite';
import { handler as acceptInvitation } from '../api/workspaces/accept-invitation';
import { handler as update } from '../api/workspaces/update';
import { handler as workspaceDelete } from '../api/workspaces/delete';
import { handler as audit } from '../api/workspaces/audit';
import { handler as transferOwnership } from '../api/workspaces/transfer-ownership';
import { handler as apiKeysCreate } from '../api/api-keys/create';
import { handler as apiKeysList } from '../api/api-keys/list';
import { handler as apiKeysDelete } from '../api/api-keys/delete';

export const routes: RouteTable = {
  'GET /workspaces': list,
  // members.ts dispatches GET vs DELETE vs PATCH internally
  'GET /workspaces/current/members': members,
  'DELETE /workspaces/current/members/{userId}': members,
  'PATCH /workspaces/current/members/{userId}': members,
  'POST /workspaces/current/invitations': invite,
  'POST /invitations/{token}/accept': acceptInvitation,
  'PATCH /workspaces/current': update,
  'DELETE /workspaces/current': workspaceDelete,
  'GET /workspaces/current/audit': audit,
  'POST /workspaces/current/transfer-ownership': transferOwnership,
  'POST /workspaces/current/api-keys': apiKeysCreate,
  'GET /workspaces/current/api-keys': apiKeysList,
  'DELETE /workspaces/current/api-keys/{id}': apiKeysDelete,
};

export const handler = makeRouter(routes);
