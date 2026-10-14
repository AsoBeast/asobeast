import { NotFoundException } from '@nestjs/common';
import { AppSetup } from '@prisma/client';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import { AppSetupService } from './app-setup.service';

const COMPLETED_AT = new Date('2026-10-01T00:00:00.000Z');

const row = (overrides: Partial<AppSetup> = {}): AppSetup => ({
  appId: 'app_1',
  workspaceId: 'ws_1',
  status: 'in_progress',
  skipped: [],
  countriesReviewed: false,
  selectedMarkets: ['us'],
  completedAt: null,
  createdAt: new Date('2026-10-14T08:00:00.000Z'),
  updatedAt: new Date('2026-10-14T09:00:00.000Z'),
  ...overrides,
});

type UpsertArgs = {
  create: Record<string, unknown>;
  update: Partial<AppSetup>;
};

function harness(setup: AppSetup | null = null, found = true) {
  const findFirst = jest
    .fn()
    .mockResolvedValue(
      found ? { id: 'app_1', country: 'us', appSetup: setup } : null,
    );
  const upsert = jest
    .fn<Promise<AppSetup>, [UpsertArgs]>()
    .mockImplementation(({ update }) =>
      Promise.resolve(
        row({
          ...setup,
          ...Object.fromEntries(
            Object.entries(update).filter(([, value]) => value !== undefined),
          ),
        }),
      ),
    );
  const createMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    app: { findFirst },
    appSetup: { upsert, createMany },
  } as unknown as PrismaService;
  const workspace = {
    require: jest.fn().mockReturnValue('ws_1'),
  } as unknown as WorkspaceContext;
  return {
    service: new AppSetupService(prisma, workspace),
    findFirst,
    upsert,
    upsertArgs: () => upsert.mock.calls[0][0],
    createMany,
  };
}

describe('AppSetupService', () => {
  it('answers the not started default for a primary app without a row', async () => {
    const { service } = harness();

    await expect(service.read('app_1')).resolves.toEqual({
      appId: 'app_1',
      status: 'not_started',
      skipped: [],
      countriesReviewed: false,
      selectedMarkets: ['us'],
      completedAt: null,
      updatedAt: null,
    });
  });

  it('reads only a primary app and answers 404 for a competitor', async () => {
    const { service, findFirst } = harness(null, false);

    await expect(service.read('rival')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update('rival', { status: 'dismissed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rival', isCompetitor: false },
      }),
    );
  });

  it('stamps completedAt when the setup completes', async () => {
    const { service, upsertArgs } = harness(row());

    await service.update('app_1', { status: 'completed' });

    expect(upsertArgs().update.status).toBe('completed');
    expect(upsertArgs().update.completedAt).toBeInstanceOf(Date);
  });

  it('keeps the first completion time when completed again', async () => {
    const { service, upsertArgs } = harness(
      row({ status: 'completed', completedAt: COMPLETED_AT }),
    );

    await service.update('app_1', { status: 'completed' });

    expect(upsertArgs().update.completedAt).toBe(COMPLETED_AT);
  });

  it('clears completedAt for any other status', async () => {
    const { service, upsertArgs } = harness(
      row({ status: 'completed', completedAt: COMPLETED_AT }),
    );

    const restarted = await service.update('app_1', {
      status: 'in_progress',
    });

    expect(upsertArgs().update.completedAt).toBeNull();
    expect(restarted.completedAt).toBeNull();
  });

  it('leaves completedAt alone when the status is not given', async () => {
    const { service, upsertArgs } = harness(row());

    await service.update('app_1', { countriesReviewed: true });

    expect(upsertArgs().update).not.toHaveProperty('completedAt');
  });

  it('stores skipped steps in step order', async () => {
    const { service, upsertArgs } = harness(row());

    await service.update('app_1', { skipped: ['countries', 'competitors'] });

    expect(upsertArgs().update.skipped).toEqual(['competitors', 'countries']);
  });

  it('creates the row in the current workspace with the home market', async () => {
    const { service, upsertArgs } = harness();

    await service.update('app_1', { skipped: ['keywords'] });

    expect(upsertArgs().create).toMatchObject({
      appId: 'app_1',
      workspaceId: 'ws_1',
      selectedMarkets: ['us'],
      skipped: ['keywords'],
    });
  });

  it('writes nothing for an empty patch', async () => {
    const { service, upsert } = harness(row({ countriesReviewed: true }));

    await expect(service.update('app_1', {})).resolves.toMatchObject({
      countriesReviewed: true,
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('begins a setup in progress without ever resetting one', async () => {
    const { service, createMany } = harness();

    await service.begin({ id: 'app_1', country: 'de' });

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          appId: 'app_1',
          workspaceId: 'ws_1',
          status: 'in_progress',
          selectedMarkets: ['de'],
        },
      ],
      skipDuplicates: true,
    });
  });
});
