import { apiHandler, getUserEmail, parseBody, HttpError } from '../../../shared/middleware/handler';
import { validate, feedbackSchema } from '../../../shared/middleware/validation';
import { queryGSI, updateItem } from '../../../shared/db/queries';
import {
  resolveTenantContext,
  getRequestedWorkspaceId,
} from '../../../shared/middleware/tenant';

export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const changeId = event.pathParameters?.id;

  if (!changeId) throw new HttpError(400, 'MISSING_ID', 'Change ID is required');

  const body = validate(feedbackSchema, parseBody(event));

  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  const userId = ctx.tenantUserId;

  const { items } = await queryGSI('GSI1', 'GSI1PK', userId, 'CHANGE#', {
    skName: 'GSI1SK',
    limit: 100,
  });
  const change = items.find((item) => item.id === changeId);
  if (!change) {
    throw new HttpError(404, 'NOT_FOUND', 'Change not found');
  }

  await updateItem(change.PK as string, change.SK as string, {
    feedbackHelpful: body.helpful,
  });

  return {
    statusCode: 200,
    body: { data: { message: 'Feedback recorded. Thank you!' } },
  };
});
