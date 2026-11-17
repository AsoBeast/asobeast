import { Logger } from '@nestjs/common';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { InstantAlertRelay, RELAY_MAX_AGE_MS } from './instant-alert-relay';
import type {
  InstantDeliveries,
  InstantJobOptions,
} from './instant-deliveries';
import { appDelisted } from './listing-events.fixture';

const NOW = new Date('2026-11-17T12:00:00.000Z');

const pending = (alertEventId: string, overrides: object = {}) => ({
  alertEventId,
  createdAt: new Date(NOW.getTime() - 60_000),
  attempts: 0,
  alertEvent: { event: 'app.delisted', payload: appDelisted() },
  ...overrides,
});

type Pending = ReturnType<typeof pending>;

const build = (rowsByWorkspace: Record<string, Pending[] | Error>) => {
  const workspace = new WorkspaceContext();
  const findMany = jest.fn((args: { distinct?: string[] }) => {
    if (args.distinct) {
      return Promise.resolve(
        Object.keys(rowsByWorkspace).map((workspaceId) => ({ workspaceId })),
      );
    }
    const rows = rowsByWorkspace[workspace.require('a relay read')];
    return rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows);
  });
  const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const enqueue = jest
    .fn<Promise<void>, [unknown, InstantJobOptions]>()
    .mockResolvedValue(undefined);
  const becauseThisWorkIsNotOwnedByOneWorkspace = jest.fn(
    (_justification: string, work: () => Promise<unknown>) =>
      workspace.runCrossTenant(work),
  );
  const relay = new InstantAlertRelay(
    {
      alertRelay: { findMany, deleteMany, updateMany },
    } as unknown as PrismaService,
    { enqueue } as unknown as InstantDeliveries,
    workspace,
    {
      becauseThisWorkIsNotOwnedByOneWorkspace,
    } as unknown as CrossTenantAccess,
  );
  return {
    relay,
    findMany,
    deleteMany,
    updateMany,
    enqueue,
    becauseThisWorkIsNotOwnedByOneWorkspace,
  };
};

describe('InstantAlertRelay.relayEveryWorkspace', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockReturnValue();
    error = jest.spyOn(Logger.prototype, 'error').mockReturnValue();
  });

  afterEach(() => jest.restoreAllMocks());

  it('enqueues each pending alert with a job id per subscription and deletes it', async () => {
    const row = pending('ev1');
    const { relay, enqueue, deleteMany } = build({ w1: [row] });

    await expect(relay.relayEveryWorkspace(NOW)).resolves.toBe(1);

    const [payload, options] = enqueue.mock.calls[0];
    expect(payload).toEqual(row.alertEvent.payload);
    expect(options('webhook', 'w1')).toEqual(
      expect.objectContaining({
        jobId: 'instant~ev1~webhook~w1',
        removeOnComplete: { age: 604800 },
      }),
    );
    expect(options('email', 'e1').jobId).toBe('instant~ev1~email~e1');
    expect(deleteMany).toHaveBeenCalledWith({ where: { alertEventId: 'ev1' } });
  });

  it('deletes a row only after its enqueue resolved', async () => {
    const { relay, enqueue, deleteMany } = build({ w1: [pending('ev1')] });

    await relay.relayEveryWorkspace(NOW);

    expect(enqueue.mock.invocationCallOrder[0]).toBeLessThan(
      deleteMany.mock.invocationCallOrder[0],
    );
  });

  it('relays the oldest first and at most one batch', async () => {
    const { relay, findMany } = build({ w1: [] });

    await relay.relayEveryWorkspace(NOW);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'asc' }, { alertEventId: 'asc' }],
        take: 100,
      }),
    );
  });

  it('keeps a row whose enqueue failed, counts the attempt and relays the rows after it', async () => {
    const { relay, enqueue, deleteMany, updateMany } = build({
      w1: [pending('ev1'), pending('ev2')],
    });
    enqueue.mockRejectedValueOnce(new Error('redis refused'));

    await expect(relay.relayEveryWorkspace(NOW)).resolves.toBe(1);

    expect(updateMany).toHaveBeenCalledWith({
      where: { alertEventId: 'ev1' },
      data: { attempts: { increment: 1 } },
    });
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { alertEventId: 'ev2' } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ev1'));
  });

  it('gives up on a row after twenty failed relays', async () => {
    const { relay, enqueue, deleteMany, updateMany } = build({
      w1: [pending('ev1', { attempts: 19 })],
    });
    enqueue.mockRejectedValueOnce(new Error('redis refused'));

    await expect(relay.relayEveryWorkspace(NOW)).resolves.toBe(0);

    expect(deleteMany).toHaveBeenCalledWith({ where: { alertEventId: 'ev1' } });
    expect(updateMany).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('after 20 failed relays'),
    );
  });

  it('goes on with the next workspace when one workspace fails', async () => {
    const { relay, deleteMany } = build({
      w1: new Error('database busy'),
      w2: [pending('ev2')],
    });

    await expect(relay.relayEveryWorkspace(NOW)).resolves.toBe(1);

    expect(deleteMany).toHaveBeenCalledWith({ where: { alertEventId: 'ev2' } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('workspace w1'));
  });

  it('resolves zero and warns when the workspaces cannot be listed', async () => {
    const { relay, enqueue, becauseThisWorkIsNotOwnedByOneWorkspace } = build(
      {},
    );
    becauseThisWorkIsNotOwnedByOneWorkspace.mockRejectedValueOnce(
      new Error('database down'),
    );

    await expect(relay.relayEveryWorkspace(NOW)).resolves.toBe(0);

    expect(enqueue).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('database down'));
  });

  it('drops a row older than seven days without enqueueing it and relays one exactly seven days old', async () => {
    const { relay, enqueue, deleteMany } = build({
      w1: [
        pending('stale', {
          createdAt: new Date(NOW.getTime() - RELAY_MAX_AGE_MS - 1),
        }),
        pending('edge', {
          createdAt: new Date(NOW.getTime() - RELAY_MAX_AGE_MS),
        }),
      ],
    });

    await expect(relay.relayEveryWorkspace(NOW)).resolves.toBe(1);

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][1]('webhook', 'w').jobId).toBe(
      'instant~edge~webhook~w',
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: { alertEventId: 'stale' },
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('stale'));
  });

  it('visits only workspaces that hold a relay row, through cross tenant access', async () => {
    const { relay, findMany, becauseThisWorkIsNotOwnedByOneWorkspace } = build({
      w1: [],
    });

    await relay.relayEveryWorkspace(NOW);

    expect(becauseThisWorkIsNotOwnedByOneWorkspace).toHaveBeenCalledWith(
      expect.stringContaining('instant alert relay'),
      expect.any(Function),
    );
    expect(findMany).toHaveBeenCalledWith({
      distinct: ['workspaceId'],
      select: { workspaceId: true },
    });
  });

  it('resolves zero when nothing is pending', async () => {
    const { relay, enqueue } = build({});

    await expect(relay.relayEveryWorkspace(NOW)).resolves.toBe(0);

    expect(enqueue).not.toHaveBeenCalled();
  });
});
