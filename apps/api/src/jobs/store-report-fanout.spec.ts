import { randomBytes } from 'node:crypto';
import { SecretBox } from '../common/crypto/secret-box';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import type { StoreReportQueue } from '../store-connect/store-report-queue';
import type { ActiveWorkspaces } from './active-workspaces';
import { StoreReportFanOut } from './store-report-fanout';

function build(box: SecretBox | null = new SecretBox(randomBytes(32))) {
  const findMany = jest.fn().mockResolvedValue([
    { workspaceId: 'ws_a', store: 'APP_STORE' },
    { workspaceId: 'ws_c', store: 'APP_STORE' },
  ]);
  const queue = { enqueue: jest.fn().mockResolvedValue({ outcome: 'queued' }) };
  const active = { forDailyRun: jest.fn().mockResolvedValue(['ws_a', 'ws_b']) };
  const workspace = new WorkspaceContext();
  const fanOut = new StoreReportFanOut(
    { storeConnection: { findMany } } as unknown as PrismaService,
    new CrossTenantAccess(workspace),
    active as unknown as ActiveWorkspaces,
    queue as unknown as StoreReportQueue,
    box,
  );
  return { fanOut, findMany, queue, active };
}

describe('StoreReportFanOut', () => {
  it('enqueues one sync per active connection of an active workspace', async () => {
    const { fanOut, queue, findMany } = build();

    await expect(fanOut.run()).resolves.toBe(1);

    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'active' },
      select: { workspaceId: true, store: true },
    });
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(queue.enqueue).toHaveBeenCalledWith('ws_a', 'APP_STORE');
  });

  it('does nothing while store connections are off', async () => {
    const { fanOut, queue, findMany } = build(null);

    expect(fanOut.enabled).toBe(false);
    await expect(fanOut.run()).resolves.toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
