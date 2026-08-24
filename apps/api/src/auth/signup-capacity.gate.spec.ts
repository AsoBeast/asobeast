import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { DailyCapacity } from '../jobs/daily-capacity.service';
import { PrismaService } from '../prisma/prisma.service';
import { SignupCapacityGate } from './signup-capacity.gate';
import type { Store } from '@asobeast/shared';

describe('SignupCapacityGate', () => {
  const queryRaw = jest.fn<Promise<{ store: Store; markets: bigint }[]>, []>();
  const perDay = jest.fn<Promise<number>, []>();

  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
      _justification: string,
      work: () => Promise<T>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const gateWith = (ceiling: number, billing = true) =>
    new SignupCapacityGate(
      prisma,
      crossTenant,
      {
        get: (key: string) => (key === 'BILLING_ENABLED' ? billing : ceiling),
      } as unknown as ConfigService<Env, true>,
      { perDay } as unknown as DailyCapacity,
    );

  const tracked = (markets: number, store: Store = 'APP_STORE') => [
    { store, markets: BigInt(markets) },
  ];

  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue(tracked(0));
    perDay.mockReset().mockResolvedValue(500);
  });

  it('never gates a self hosted instance', async () => {
    queryRaw.mockResolvedValue(tracked(10_000));

    await expect(
      gateWith(0.9, false).assertRoomForOneMore(),
    ).resolves.toBeUndefined();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('never gates while no ceiling is configured', async () => {
    queryRaw.mockResolvedValue(tracked(10_000));

    await expect(gateWith(0).assertRoomForOneMore()).resolves.toBeUndefined();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('admits a signup while capacity is available', async () => {
    queryRaw.mockResolvedValue(tracked(100));

    await expect(gateWith(0.9).assertRoomForOneMore()).resolves.toBeUndefined();
  });

  it('refuses a signup the pool cannot serve', async () => {
    queryRaw.mockResolvedValue(tracked(950));

    await expect(gateWith(0.9).assertRoomForOneMore()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('reports utilization across both store budgets', async () => {
    queryRaw.mockResolvedValue(tracked(250));

    await expect(gateWith(0.9).utilization()).resolves.toBe(0.25);
  });

  it('charges a play keyword the requests its search actually costs', async () => {
    queryRaw.mockResolvedValue(tracked(100, 'GOOGLE_PLAY'));

    await expect(gateWith(0.9).utilization()).resolves.toBe(0.8);
  });

  it('reports no pressure when there is no capacity to measure', async () => {
    perDay.mockResolvedValue(0);

    await expect(gateWith(0.9).utilization()).resolves.toBe(0);
  });
});
