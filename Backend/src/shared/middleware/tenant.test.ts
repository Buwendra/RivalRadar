import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the DynamoDB query helpers; the key builders (../db/keys) stay real
// since they're pure string functions.
vi.mock('../db/queries', () => ({
  queryGSI: vi.fn(),
  queryByPK: vi.fn(),
  getItem: vi.fn(),
}));

import {
  resolveTenantContext,
  getRequestedWorkspaceId,
  assertOwner,
  assertAdminOrOwner,
  type TenantContext,
} from './tenant';
import { queryGSI, queryByPK, getItem } from '../db/queries';
import { workspacePK } from '../db/keys';
import type { Membership, Workspace } from '../types';

const mockQueryGSI = vi.mocked(queryGSI);
const mockQueryByPK = vi.mocked(queryByPK);
const mockGetItem = vi.mocked(getItem);

const EMAIL = 'caller@example.com';
const CALLER = 'caller-1';

/** queryGSI(email) → the user-by-email row carrying GSI3SK=USER#<callerUserId>. */
function emailFound(callerUserId = CALLER) {
  mockQueryGSI.mockResolvedValue({ items: [{ GSI3SK: `USER#${callerUserId}` }] });
}

// Returned as Record<string, unknown> to match queryByPK's item type.
function membership(workspaceId: string, role: Membership['role']): Record<string, unknown> {
  const m: Membership = { workspaceId, userId: CALLER, role, joinedAt: '2026-01-01T00:00:00Z' };
  return m as unknown as Record<string, unknown>;
}

function workspace(over: Partial<Workspace> & Pick<Workspace, 'id' | 'ownerUserId'>): Workspace {
  return {
    name: `ws-${over.id}`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveTenantContext', () => {
  it('throws 404 when the email is not found', async () => {
    mockQueryGSI.mockResolvedValue({ items: [] });
    await expect(resolveTenantContext(EMAIL)).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('returns the caller as their own tenant when they have no memberships (legacy user)', async () => {
    emailFound();
    mockQueryByPK.mockResolvedValue({ items: [] });

    const ctx = await resolveTenantContext(EMAIL);

    expect(ctx.tenantUserId).toBe(CALLER);
    expect(ctx.callerUserId).toBe(CALLER);
    expect(ctx.role).toBe('owner');
    expect(ctx.workspaceName).toBe('(personal)');
    // Never hits the workspace lookup on the legacy path.
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it('resolves a single membership to its workspace tenant', async () => {
    emailFound();
    mockQueryByPK.mockResolvedValue({ items: [membership('ws-1', 'member')] });
    mockGetItem.mockResolvedValue(
      workspace({ id: 'ws-1', ownerUserId: 'owner-1', tenantUserId: 'tenant-1', name: 'Acme' })
    );

    const ctx = await resolveTenantContext(EMAIL);

    expect(ctx.tenantUserId).toBe('tenant-1');
    expect(ctx.workspaceId).toBe('ws-1');
    expect(ctx.workspaceName).toBe('Acme');
    expect(ctx.role).toBe('member');
  });

  it('honors X-Workspace-Id when the caller belongs to multiple workspaces', async () => {
    emailFound();
    mockQueryByPK.mockResolvedValue({
      items: [membership('ws-1', 'member'), membership('ws-2', 'member')],
    });
    mockGetItem.mockResolvedValue(workspace({ id: 'ws-2', ownerUserId: 'owner-2', tenantUserId: 'tenant-2' }));

    const ctx = await resolveTenantContext(EMAIL, 'ws-2');

    expect(ctx.workspaceId).toBe('ws-2');
    expect(ctx.tenantUserId).toBe('tenant-2');
    // The workspace looked up is the requested one.
    expect(mockGetItem).toHaveBeenCalledWith(workspacePK('ws-2'), expect.anything());
  });

  it('falls back to the owner-role membership when no workspace is requested', async () => {
    emailFound();
    mockQueryByPK.mockResolvedValue({
      items: [membership('ws-1', 'member'), membership('ws-2', 'owner')],
    });
    mockGetItem.mockResolvedValue(workspace({ id: 'ws-2', ownerUserId: CALLER, tenantUserId: CALLER }));

    const ctx = await resolveTenantContext(EMAIL);

    expect(mockGetItem).toHaveBeenCalledWith(workspacePK('ws-2'), expect.anything());
    expect(ctx.role).toBe('owner');
  });

  it('falls back to caller-as-tenant when the membership references a missing workspace', async () => {
    emailFound();
    mockQueryByPK.mockResolvedValue({ items: [membership('ws-ghost', 'member')] });
    mockGetItem.mockResolvedValue(null); // data inconsistency

    const ctx = await resolveTenantContext(EMAIL);

    expect(ctx.tenantUserId).toBe(CALLER);
    expect(ctx.workspaceName).toBe('(personal)');
    expect(ctx.role).toBe('owner');
  });

  it('falls back to ownerUserId for pre-Phase-4c rows without tenantUserId', async () => {
    emailFound();
    mockQueryByPK.mockResolvedValue({ items: [membership('ws-1', 'admin')] });
    mockGetItem.mockResolvedValue(workspace({ id: 'ws-1', ownerUserId: 'legacy-owner' })); // no tenantUserId

    const ctx = await resolveTenantContext(EMAIL);

    expect(ctx.tenantUserId).toBe('legacy-owner');
    expect(ctx.role).toBe('admin');
  });
});

describe('getRequestedWorkspaceId', () => {
  it('extracts the lowercased X-Workspace-Id header', () => {
    expect(getRequestedWorkspaceId({ 'x-workspace-id': 'ws-9' })).toBe('ws-9');
  });
  it('returns undefined when the header is absent', () => {
    expect(getRequestedWorkspaceId({})).toBeUndefined();
  });
});

describe('role guards', () => {
  const ctx = (role: TenantContext['role']): TenantContext => ({
    tenantUserId: 't',
    callerUserId: 'c',
    callerEmail: EMAIL,
    workspaceId: 'ws',
    workspaceName: 'WS',
    role,
  });

  it('assertOwner passes for owner, 403s for admin/member', () => {
    expect(() => assertOwner(ctx('owner'))).not.toThrow();
    expect(() => assertOwner(ctx('admin'))).toThrow(/owner/i);
    try {
      assertOwner(ctx('member'));
      throw new Error('expected throw');
    } catch (e) {
      expect((e as { statusCode: number }).statusCode).toBe(403);
    }
  });

  it('assertAdminOrOwner passes for owner+admin, 403s for member', () => {
    expect(() => assertAdminOrOwner(ctx('owner'))).not.toThrow();
    expect(() => assertAdminOrOwner(ctx('admin'))).not.toThrow();
    expect(() => assertAdminOrOwner(ctx('member'))).toThrow(/owners or admins/i);
  });
});
