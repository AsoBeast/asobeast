import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { AppLocalizationsResult } from '@asobeast/shared';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JOBS } from '../jobs/jobs.types';
import type { AppLocalizationsService } from '../keywords/app-localizations.service';
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
    fresh?: object;
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
    : jest.fn((_id: string, _country: string, localization?: string) =>
        Promise.resolve(
          localization === undefined && options.fresh
            ? options.fresh
            : (options.served ?? SPANISH),
        ),
      );
  const prisma = {
    app: { findFirst: appFindFirst },
    appSnapshot: { findFirst: snapshotFindFirst },
    appLocalization: { createMany },
  } as unknown as PrismaService;
  const registry = {
    get: () => ({ getApp }),
  } as unknown as StoreProviderRegistry;
  return {
    detection: new LocalizationDetection(
      prisma,
      registry,
      {} as AppLocalizationsService,
      {} as WorkspaceContext,
      {} as Queue,
    ),
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

  it('compares with a fresh default listing when the app released a version since the stored one', async () => {
    const released = {
      ...ENGLISH,
      version: '5.0',
      raw: { screenshots: [], releaseNotes: 'New in 5.0' },
    };
    const { detection, getApp, createMany } = build({
      stored: { ...ENGLISH, version: '4.0' },
      served: released,
      fresh: released,
    });

    await detection.probe(PROBE);

    expect(getApp).toHaveBeenCalledWith('6657987209', 'mx');
    expect(createMany).not.toHaveBeenCalled();
  });

  it('asks the store once when the stored listing is of the served version', async () => {
    const { detection, getApp, createMany } = build({
      stored: { ...ENGLISH, version: '4.0' },
      served: { ...SPANISH, version: '4.0' },
    });

    await detection.probe(PROBE);

    expect(getApp).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledTimes(1);
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

  it('does nothing for a competitor app', async () => {
    const { detection, getApp, createMany } = build({
      app: { ...APP, isCompetitor: true },
    });

    await detection.probe(PROBE);

    expect(getApp).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
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

interface QueuedJob {
  name: string;
  data: { enqueueClaim?: string };
  failed: boolean;
}

class FakeQueue {
  readonly jobs = new Map<string, QueuedJob>();
  readonly claimedElsewhere = new Set<string>();
  readonly add = jest.fn(
    (name: string, data: QueuedJob['data'], { jobId }: { jobId: string }) => {
      this.jobs.set(jobId, {
        name,
        data: this.claimedElsewhere.has(jobId)
          ? { enqueueClaim: 'another request' }
          : data,
        failed: false,
      });
      return Promise.resolve(undefined);
    },
  );
  readonly remove = jest.fn((jobId: string) =>
    Promise.resolve(this.jobs.delete(jobId) ? 1 : 0),
  );
  readonly getJob = jest.fn((jobId: string) => {
    const job = this.jobs.get(jobId);
    return Promise.resolve(
      job && { data: job.data, isFailed: () => Promise.resolve(job.failed) },
    );
  });

  hold(jobId: string, failed = false): void {
    this.jobs.set(jobId, { name: JOBS.DETECT_LOCALIZATION, data: {}, failed });
  }
}

const homeItem = {
  localization: 'en-US' as const,
  origin: 'home' as const,
  phrases: [],
  charactersUsed: 0,
  charactersLimit: 100,
  readBy: [],
  updatedAt: null,
};

const shippedResult = (markets: string[]): AppLocalizationsResult => ({
  home: 'us',
  markets,
  localizations: [homeItem],
});

const jobIdOf = (localization: string) =>
  `detect-localization~app_1~${localization}~2026-10-12`;

const buildRequest = (
  options: {
    app?: object | null;
    languages?: string[];
    markets?: string[];
  } = {},
) => {
  const appFindFirst = jest.fn().mockResolvedValue(
    options.app === undefined
      ? {
          id: 'app_1',
          workspaceId: 'ws_a',
          store: Store.APP_STORE,
          storeAppId: '6657987209',
          country: 'us',
        }
      : options.app,
  );
  const listing = {
    id: 'snap_1',
    title: 'Title',
    subtitle: null,
    summary: null,
    description: 'Text',
    raw: { languages: options.languages ?? ['EN', 'ES', 'FR'] },
  };
  const snapshotFindFirst = jest.fn(() => Promise.resolve(listing));
  const list = jest
    .fn()
    .mockResolvedValue(shippedResult(options.markets ?? ['us']));
  const queue = new FakeQueue();
  const workspace = {
    scopeFor: jest
      .fn()
      .mockReturnValue({ workspaceId: 'ws_a', correlationId: 'req_1' }),
  };
  const spend = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    app: { findFirst: appFindFirst },
    appSnapshot: { findFirst: snapshotFindFirst },
  } as unknown as PrismaService;
  const detection = new LocalizationDetection(
    prisma,
    {} as StoreProviderRegistry,
    { list } as unknown as AppLocalizationsService,
    workspace as unknown as WorkspaceContext,
    queue as unknown as Queue,
  );
  return {
    detection,
    queue,
    spend,
    list,
    request: (capturedIn?: string) =>
      detection.request('app_1', spend, capturedIn),
  };
};

describe('LocalizationDetection.request', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-12T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('queues one deferred job per candidate with a day scoped id and the workspace scope', async () => {
    const { queue, request } = buildRequest();

    await expect(request()).resolves.toEqual({
      queued: 2,
      candidates: ['fr', 'es-MX'],
    });
    expect(queue.add.mock.calls).toEqual(
      ['fr', 'es-MX'].map((localization) => [
        JOBS.DETECT_LOCALIZATION,
        {
          appId: 'app_1',
          localization,
          country: 'us',
          workspaceId: 'ws_a',
          correlationId: 'req_1',
          enqueueClaim: expect.any(String) as string,
        },
        {
          priority: 1,
          removeOnComplete: { age: 86_400 },
          jobId: jobIdOf(localization),
        },
      ]),
    );
  });

  it('keeps a finished probe for a day so the day scoped id holds whatever else the queue runs', async () => {
    const { queue, request } = buildRequest();

    await request();

    expect(queue.add.mock.calls.map(([, , options]) => options)).toEqual(
      ['fr', 'es-MX'].map(
        (localization) =>
          expect.objectContaining({
            jobId: jobIdOf(localization),
            removeOnComplete: { age: 86_400 },
          }) as unknown,
      ),
    );
  });

  it('spends once, before the first job is added', async () => {
    const { queue, spend, request } = buildRequest();

    await request();

    expect(spend).toHaveBeenCalledTimes(1);
    expect(spend.mock.invocationCallOrder[0]).toBeLessThan(
      queue.add.mock.invocationCallOrder[0],
    );
  });

  it('spends nothing and queues nothing when every candidate is queued today', async () => {
    const { queue, spend, request } = buildRequest();
    queue.hold(jobIdOf('fr'));
    queue.hold(jobIdOf('es-MX'));

    await expect(request()).resolves.toEqual({
      queued: 0,
      candidates: ['fr', 'es-MX'],
    });
    expect(spend).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('spends nothing when no language is a candidate', async () => {
    const { spend, request } = buildRequest({ languages: ['EN'] });

    await expect(request()).resolves.toEqual({ queued: 0, candidates: [] });
    expect(spend).not.toHaveBeenCalled();
  });

  it('queues again a candidate whose job failed today', async () => {
    const { queue, spend, request } = buildRequest();
    queue.hold(jobIdOf('fr'), true);
    queue.hold(jobIdOf('es-MX'));

    await expect(request()).resolves.toEqual({
      queued: 1,
      candidates: ['fr', 'es-MX'],
    });
    expect(queue.remove).toHaveBeenCalledWith(jobIdOf('fr'));
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(spend).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing', null, NotFoundException],
    [
      'on google play',
      { id: 'app_1', store: Store.GOOGLE_PLAY, country: 'us' },
      BadRequestException,
    ],
  ])(
    'spends nothing when the app is %s',
    async (_case, app, refusal: new (...args: never[]) => Error) => {
      const { queue, spend, list, request } = buildRequest({ app });

      await expect(request()).rejects.toBeInstanceOf(refusal);
      expect(list).not.toHaveBeenCalled();
      expect(spend).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    },
  );

  it('spends nothing and queues nothing for a competitor app', async () => {
    const { queue, spend, request } = buildRequest({
      app: {
        id: 'app_1',
        workspaceId: 'ws_a',
        store: Store.APP_STORE,
        storeAppId: '6657987209',
        country: 'us',
        isCompetitor: true,
      },
    });

    await expect(request()).resolves.toEqual({ queued: 0, candidates: [] });
    expect(spend).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('keeps every candidate when the home listing declares no languages', async () => {
    const { request } = buildRequest({ languages: [] });

    await expect(request()).resolves.toMatchObject({ queued: 9 });
  });

  it('probes in the first market that can probe the localization', async () => {
    const { queue, request } = buildRequest({
      markets: ['us', 'au'],
      languages: ['EN', 'FR'],
    });

    await request();

    const countryOf = (localization: string) =>
      (
        queue.add.mock.calls.find(
          ([, data]) =>
            (data as unknown as { localization: string }).localization ===
            localization,
        )?.[1] as unknown as { country: string } | undefined
      )?.country;
    expect(countryOf('en-GB')).toBe('au');
    expect(countryOf('fr')).toBe('us');
  });

  it('counts only the jobs this request queued', async () => {
    const { queue, request } = buildRequest();
    queue.claimedElsewhere.add(jobIdOf('es-MX'));

    await expect(request()).resolves.toEqual({
      queued: 1,
      candidates: ['fr', 'es-MX'],
    });
  });

  it('probes the market a capture just listed before any keyword is tracked there', async () => {
    const { queue, request } = buildRequest({ languages: ['EN', 'IT'] });

    await expect(request('ch')).resolves.toEqual({
      queued: 2,
      candidates: ['en-GB', 'it'],
    });
    expect(
      queue.add.mock.calls.map(
        ([, data]) => (data as unknown as { country: string }).country,
      ),
    ).toEqual(['ch', 'ch']);
  });
});
