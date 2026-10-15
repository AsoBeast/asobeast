import { NotFoundException } from '@nestjs/common';
import { ChartKey } from '@asobeast/shared';
import { Prisma } from '@prisma/client';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { ChartFollowsService } from './chart-follows.service';
import { UnknownChartGenreError } from './chart-key';

const KEY: ChartKey = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6014',
  device: 'iphone',
};

const ROW = {
  ...KEY,
  id: 'follow-1',
  workspaceId: 'ws_one',
  createdAt: new Date('2026-10-15T09:00:00.000Z'),
};

const build = () => {
  const tx = { chartFollow: { create: jest.fn().mockResolvedValue(ROW) } };
  const prisma = {
    chartFollow: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([ROW]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const quota = {
    limitFor: jest.fn().mockResolvedValue(null),
    admitChartFollow: jest.fn(
      (write: (client: typeof tx) => Promise<unknown>) => write(tx),
    ),
  };
  const workspace = new WorkspaceContext();
  const service = new ChartFollowsService(
    prisma as unknown as PrismaService,
    quota as unknown as QuotaService,
    workspace,
  );
  const scoped = <T>(work: () => Promise<T>) => workspace.run('ws_one', work);
  return { service, prisma, quota, tx, scoped };
};

describe('ChartFollowsService', () => {
  it('records a new follow under the quota', async () => {
    const { service, quota, tx, scoped } = build();

    const result = await scoped(() =>
      service.follow({ ...KEY, extra: 1 } as ChartKey),
    );

    expect(result.created).toBe(true);
    expect(result.item).toEqual({
      ...KEY,
      id: 'follow-1',
      genreName: 'Games',
      createdAt: '2026-10-15T09:00:00.000Z',
    });
    expect(quota.admitChartFollow).toHaveBeenCalledTimes(1);
    expect(tx.chartFollow.create).toHaveBeenCalledWith({
      data: { ...KEY, workspaceId: 'ws_one' },
    });
  });

  it('answers an existing follow without spending the quota', async () => {
    const { service, prisma, quota, scoped } = build();
    prisma.chartFollow.findFirst.mockResolvedValue(ROW);

    const result = await scoped(() => service.follow(KEY));

    expect(result).toMatchObject({ created: false, item: { id: 'follow-1' } });
    expect(quota.admitChartFollow).not.toHaveBeenCalled();
  });

  it('answers the follow a concurrent request recorded', async () => {
    const { service, prisma, tx, scoped } = build();
    tx.chartFollow.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '7.8.0',
      }),
    );
    prisma.chartFollow.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ROW);

    await expect(scoped(() => service.follow(KEY))).resolves.toMatchObject({
      created: false,
      item: { id: 'follow-1' },
    });
  });

  it('refuses a key the store does not chart before reading', async () => {
    const { service, prisma, scoped } = build();

    await expect(
      scoped(() => service.follow({ ...KEY, genre: 'GAME' })),
    ).rejects.toBeInstanceOf(UnknownChartGenreError);
    expect(prisma.chartFollow.findFirst).not.toHaveBeenCalled();
  });

  it('answers 404 for a follow it cannot see', async () => {
    const { service, prisma } = build();
    prisma.chartFollow.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.forget('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('turns every follow into a category bucket', async () => {
    const { service, prisma } = build();
    prisma.chartFollow.findMany.mockResolvedValue([
      { store: 'APP_STORE', country: 'us', collection: 'free', genre: '6014' },
    ]);

    await expect(service.buckets()).resolves.toEqual([
      { store: 'APP_STORE', country: 'us', collection: 'free', genre: '6014' },
    ]);
  });

  it('schedules only the oldest follows the plan has room for', async () => {
    const { service, prisma, quota } = build();
    quota.limitFor.mockResolvedValue(10);

    await service.buckets();

    expect(quota.limitFor).toHaveBeenCalledWith('chartFollows');
    expect(prisma.chartFollow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 10,
      }),
    );
  });

  it('schedules every follow when the plan sets no limit', async () => {
    const { service, prisma } = build();

    await service.buckets();

    expect(prisma.chartFollow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: undefined }),
    );
  });
});
