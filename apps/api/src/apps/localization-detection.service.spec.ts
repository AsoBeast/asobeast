import { Store } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { LocalizationDetection } from './localization-detection.service';

const ENGLISH = {
  title: 'Where Am I? GeoGuess Map Quiz',
  subtitle: 'World Geography Trivia Game',
  description: 'Discover the world',
  raw: { screenshots: [] },
};

const SPANISH = {
  title: '¿Dónde estoy? Quiz de mapas',
  subtitle: 'Juego de geografía',
  description: 'Descubre el mundo',
  raw: { screenshots: [] },
};

const APP = {
  workspaceId: 'ws_a',
  store: Store.APP_STORE,
  storeAppId: '6657987209',
  country: 'us',
};

const PROBE = {
  appId: 'app_1',
  localization: 'es-MX' as const,
  country: 'mx',
  workspaceId: 'ws_a',
};

const build = (
  options: {
    app?: object | null;
    stored?: object | null;
    served?: object;
    failure?: Error;
  } = {},
) => {
  const appFindFirst = jest
    .fn()
    .mockResolvedValue(options.app === undefined ? APP : options.app);
  const snapshotFindFirst = jest
    .fn()
    .mockResolvedValue(options.stored === undefined ? ENGLISH : options.stored);
  const createMany = jest.fn().mockResolvedValue({ count: 1 });
  const getApp = options.failure
    ? jest.fn().mockRejectedValue(options.failure)
    : jest.fn().mockResolvedValue(options.served ?? SPANISH);
  const prisma = {
    app: { findFirst: appFindFirst },
    appSnapshot: { findFirst: snapshotFindFirst },
    appLocalization: { createMany },
  } as unknown as PrismaService;
  const registry = {
    get: () => ({ getApp }),
  } as unknown as StoreProviderRegistry;
  return {
    detection: new LocalizationDetection(prisma, registry),
    appFindFirst,
    snapshotFindFirst,
    createMany,
    getApp,
  };
};

describe('LocalizationDetection.probe', () => {
  it('asks the store for the localization in the probe market and records it as detected when served', async () => {
    const { detection, getApp, createMany } = build();

    await detection.probe(PROBE);

    expect(getApp).toHaveBeenCalledWith('6657987209', 'mx', 'es-MX');
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          appId: 'app_1',
          workspaceId: 'ws_a',
          localization: 'es-MX',
          origin: 'detected',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('compares with the stored default listing of the probe market, not the home market', async () => {
    const { detection, snapshotFindFirst } = build();

    await detection.probe(PROBE);

    expect(snapshotFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          appId: 'app_1',
          country: 'mx',
          localization: null,
        }) as unknown,
      }),
    );
  });

  it('records nothing when the store echoes the default listing', async () => {
    const { detection, createMany } = build({ served: ENGLISH });

    await detection.probe(PROBE);

    expect(createMany).not.toHaveBeenCalled();
  });

  it('sends no request when the market has no stored default listing', async () => {
    const { detection, getApp, createMany } = build({ stored: null });

    await detection.probe(PROBE);

    expect(getApp).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it.each([
    ['gone', null],
    ['on google play', { ...APP, store: Store.GOOGLE_PLAY }],
  ])('does nothing for an app that is %s', async (_case, app) => {
    const { detection, getApp, snapshotFindFirst } = build({ app });

    await detection.probe(PROBE);

    expect(snapshotFindFirst).not.toHaveBeenCalled();
    expect(getApp).not.toHaveBeenCalled();
  });

  it('lets a store failure fail the job so the queue retries it', async () => {
    const failure = new Error('lookup failed for es-MX');
    const { detection, createMany } = build({ failure });

    await expect(detection.probe(PROBE)).rejects.toBe(failure);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('reads the app through the policies without a workspace in the query', async () => {
    const { detection, appFindFirst } = build();

    await detection.probe(PROBE);

    expect(appFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'app_1' } }),
    );
  });
});
