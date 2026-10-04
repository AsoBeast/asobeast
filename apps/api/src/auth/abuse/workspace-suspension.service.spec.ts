import { ConflictException } from '@nestjs/common';
import { DEFAULT_WORKSPACE_ID } from '../../common/tenancy/default-workspace';
import type { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  OPERATOR_WORKSPACE_NOT_SUSPENDABLE,
  WorkspaceSuspension,
} from './workspace-suspension.service';

const NOW = new Date('2026-10-04T10:00:00.000Z');

function suspensionOverFakes() {
  const update = jest.fn().mockResolvedValue({});
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: jest.fn(
      (_justification: string, work: () => Promise<unknown>) => work(),
    ),
  };
  const suspension = new WorkspaceSuspension(
    { workspace: { update } } as unknown as PrismaService,
    crossTenant as unknown as CrossTenantAccess,
  );
  return { suspension, update };
}

describe('WorkspaceSuspension', () => {
  it('suspends a customer workspace with the reason', async () => {
    const { suspension, update } = suspensionOverFakes();

    await suspension.suspend('ws_customer', 'sustained abuse', NOW);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'ws_customer' },
      data: { suspendedAt: NOW, suspendedReason: 'sustained abuse' },
    });
  });

  it('refuses to suspend the operator workspace and writes nothing', async () => {
    const { suspension, update } = suspensionOverFakes();

    await expect(
      suspension.suspend(DEFAULT_WORKSPACE_ID, 'operator suspends self', NOW),
    ).rejects.toThrow(
      new ConflictException(OPERATOR_WORKSPACE_NOT_SUSPENDABLE),
    );

    expect(update).not.toHaveBeenCalled();
  });

  it('restores any workspace, the operator workspace included', async () => {
    const { suspension, update } = suspensionOverFakes();

    await suspension.restore(DEFAULT_WORKSPACE_ID);

    expect(update).toHaveBeenCalledWith({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { suspendedAt: null, suspendedReason: null, abuseFlaggedAt: null },
    });
  });
});
