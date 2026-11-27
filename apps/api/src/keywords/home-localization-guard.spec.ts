import type { Prisma } from '@prisma/client';
import { unlessHomeLocalization } from './home-localization-guard';

const txWith = (
  app: { country: string; defaultLocalization: string | null } | null,
) =>
  ({
    app: { findFirst: jest.fn().mockResolvedValue(app) },
  }) as unknown as Prisma.TransactionClient;

describe('unlessHomeLocalization', () => {
  it('allows a localization that is not home when the write runs', async () => {
    await expect(
      unlessHomeLocalization(
        'app_1',
        'en-GB',
      )(txWith({ country: 'pl', defaultLocalization: 'pl' })),
    ).resolves.toBe(true);
  });

  it('refuses a localization that became home before the write', async () => {
    await expect(
      unlessHomeLocalization(
        'app_1',
        'en-GB',
      )(txWith({ country: 'pl', defaultLocalization: null })),
    ).resolves.toBe(false);
    await expect(
      unlessHomeLocalization(
        'app_1',
        'pl',
      )(txWith({ country: 'pl', defaultLocalization: 'pl' })),
    ).resolves.toBe(false);
  });

  it('refuses when the app is gone', async () => {
    await expect(
      unlessHomeLocalization('app_1', 'en-GB')(txWith(null)),
    ).resolves.toBe(false);
  });

  it('reads the app inside the write transaction', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ country: 'pl', defaultLocalization: 'pl' });
    const tx = { app: { findFirst } } as unknown as Prisma.TransactionClient;

    await unlessHomeLocalization('app_1', 'en-GB')(tx);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'app_1' },
      select: { country: true, defaultLocalization: true },
    });
  });
});
