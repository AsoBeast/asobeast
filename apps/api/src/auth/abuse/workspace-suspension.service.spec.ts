import { ConflictException, NotFoundException } from '@nestjs/common';
import { DEFAULT_WORKSPACE_ID } from '../../common/tenancy/default-workspace';
import type { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  OPERATOR_WORKSPACE_NOT_SUSPENDABLE,
  WORKSPACE_ALREADY_SUSPENDED,
  WORKSPACE_NOT_FOUND,
  WORKSPACE_NOT_SUSPENDED,
  WorkspaceSuspension,
} from './workspace-suspension.service';

const NOW = new Date('2026-10-04T10:00:00.000Z');

function suspensionOverFakes({ changed = 1, existing = 1 } = {}) {
  const updateMany = jest.fn().mockResolvedValue({ count: changed });
  const count = jest.fn().mockResolvedValue(existing);
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: jest.fn(
      (_justification: string, work: () => Promise<unknown>) => work(),
    ),
  };
  const suspension = new WorkspaceSuspension(
    { workspace: { updateMany, count } } as unknown as PrismaService,
    crossTenant as unknown as CrossTenantAccess,
  );
  return { suspension, updateMany };
}

describe('WorkspaceSuspension', () => {
  it('suspends an active customer workspace with the reason', async () => {
    const { suspension, updateMany } = suspensionOverFakes();

    await suspension.suspend('ws_customer', 'sustained abuse', NOW);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ws_customer', suspendedAt: null },
      data: { suspendedAt: NOW, suspendedReason: 'sustained abuse' },
    });
  });

  it('refuses to suspend a workspace that is already suspended', async () => {
    const { suspension } = suspensionOverFakes({ changed: 0 });

    await expect(
      suspension.suspend('ws_customer', 'a second reason', NOW),
    ).rejects.toThrow(new ConflictException(WORKSPACE_ALREADY_SUSPENDED));
  });

  it('answers not found for a workspace that does not exist', async () => {
    const { suspension } = suspensionOverFakes({ changed: 0, existing: 0 });

    await expect(
      suspension.suspend('ws_missing', 'sustained abuse', NOW),
    ).rejects.toThrow(new NotFoundException(WORKSPACE_NOT_FOUND));
    await expect(suspension.restore('ws_missing')).rejects.toThrow(
      new NotFoundException(WORKSPACE_NOT_FOUND),
    );
  });

  it('refuses to suspend the operator workspace and writes nothing', async () => {
    const { suspension, updateMany } = suspensionOverFakes();

    await expect(
      suspension.suspend(DEFAULT_WORKSPACE_ID, 'operator suspends self', NOW),
    ).rejects.toThrow(
      new ConflictException(OPERATOR_WORKSPACE_NOT_SUSPENDABLE),
    );

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('restores a suspended workspace, the operator workspace included', async () => {
    const { suspension, updateMany } = suspensionOverFakes();

    await suspension.restore(DEFAULT_WORKSPACE_ID);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: DEFAULT_WORKSPACE_ID, suspendedAt: { not: null } },
      data: { suspendedAt: null, suspendedReason: null, abuseFlaggedAt: null },
    });
  });

  it('refuses to restore a workspace that is not suspended', async () => {
    const { suspension } = suspensionOverFakes({ changed: 0 });

    await expect(suspension.restore('ws_customer')).rejects.toThrow(
      new ConflictException(WORKSPACE_NOT_SUSPENDED),
    );
  });
});
