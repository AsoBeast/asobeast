import './helpers/enable-store-connect';
import { getQueueToken } from '@nestjs/bullmq';
import type {
  AppDetail,
  AppLocalizationsResult,
  TrackedKeywordItem,
} from '@asobeast/shared';
import type { Queue } from 'bullmq';
import { QUEUES } from '../src/jobs/jobs.types';
import { StoreReportSyncService } from '../src/store-connect/store-report-sync.service';
import {
  DE_APP_URL,
  ENGLISH_ONLY,
  LocalizedRegistry,
} from './helpers/localized-store';
import { ownerAgent } from './helpers/session';
import {
  answer,
  CONNECTION_REQUEST,
  startStoreConnectApp,
  type StoreConnectHarness,
} from './helpers/store-connect-harness';
import { asWorkspace } from './helpers/tenancy';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const US_PAGE = {
  ...ENGLISH_ONLY,
  title: 'Family Planner',
  description:
    'Family Planner keeps the whole household on one shared calendar. Add chores, school runs and shopping lists, color code every family member and get a reminder before each event. Everyone sees changes at once on every phone and tablet.',
  languages: ['EN'],
};

const UK_PAGE = {
  ...US_PAGE,
  title: 'Family Organiser',
  description:
    'Family Organiser keeps the whole household on one shared calendar. Add chores, the school run and the weekly shop, colour code every family member and get a reminder before each event. Everyone sees changes at once on every phone and tablet.',
};

interface ConsoleLocalization {
  locale: string;
  keywords: string;
  description: string;
}

describe('The home localization App Store Connect serves (e2e)', () => {
  const registry = new LocalizedRegistry();
  let harness: StoreConnectHarness;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;

  const storeConnect = () =>
    harness.app.get<Queue>(getQueueToken(QUEUES.STORE_CONNECT), {
      strict: false,
    });

  const scriptConsole = (
    localizations: ConsoleLocalization[],
    version = '4.0',
  ) => {
    harness.asc.reset();
    harness.asc
      .on('GET', /\/appStoreVersions\?/, () =>
        answer({
          data: [
            {
              type: 'appStoreVersions',
              id: 'v1',
              attributes: {
                versionString: version,
                createdDate: '2026-11-01T00:00:00.000Z',
              },
            },
          ],
        }),
      )
      .on('GET', /\/appStoreVersionLocalizations\?/, () =>
        answer({
          data: localizations.map((attributes, index) => ({
            type: 'appStoreVersionLocalizations',
            id: `l${index}`,
            attributes,
          })),
        }),
      )
      .on('GET', /^\/v1\/apps\/\d+\?fields\[apps\]=primaryLocale$/, () =>
        answer({
          data: {
            type: 'apps',
            id: '6657987209',
            attributes: { primaryLocale: 'en-US' },
          },
        }),
      );
  };

  const sync = () =>
    asWorkspace(harness.app, () =>
      harness.app.get(StoreReportSyncService).run('APP_STORE', true),
    );

  const refresh = (appId: string) =>
    owner.post(`/apps/${appId}/refresh`).expect(200);

  const localizationsOf = async (appId: string) =>
    (
      (await owner.get(`/apps/${appId}/localizations`).expect(200))
        .body as AppLocalizationsResult
    ).localizations;

  const defaultOf = async (appId: string) =>
    (
      await harness.prisma.app.findUniqueOrThrow({
        where: { id: appId },
        select: { defaultLocalization: true },
      })
    ).defaultLocalization;

  const trackedIn = async (appId: string, country: string) =>
    (
      (await owner.get(`/apps/${appId}/keywords`).query({ country }))
        .body as TrackedKeywordItem[]
    ).map((keyword) => keyword.text);

  const importFrom = async () =>
    (
      (await owner.post('/apps').send({ url: DE_APP_URL }).expect(201))
        .body as AppDetail
    ).id;

  const follow = async (appId: string) => {
    await owner.post(`/apps/${appId}/keyword-fields/import`).expect(200);
    await storeConnect().drain(true);
  };

  const classB = () => {
    registry.listings.set('de:default', US_PAGE);
    registry.listings.set('de:en-GB', UK_PAGE);
  };

  const twoEnglishPages: ConsoleLocalization[] = [
    {
      locale: 'en-US',
      keywords: 'calendar,chores',
      description: US_PAGE.description,
    },
    {
      locale: 'en-GB',
      keywords: 'rota,chores',
      description: UK_PAGE.description,
    },
  ];

  const followingClassB = async () => {
    classB();
    const appId = await importFrom();
    await follow(appId);
    scriptConsole(twoEnglishPages);
    await sync();
    await refresh(appId);
    return appId;
  };

  beforeAll(async () => {
    harness = await startStoreConnectApp(registry);
    await pauseQueues(harness.app);
    owner = await ownerAgent(harness.app);
  }, 60_000);

  beforeEach(async () => {
    registry.reset();
    harness.asc.reset();
    await harness.prisma.storeConnection.deleteMany({});
    await harness.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppGroup" RESTART IDENTITY CASCADE',
    );
    await clearRateLimitCounters(harness.app);
    await owner
      .put('/store-connections/APP_STORE')
      .send(CONNECTION_REQUEST)
      .expect(200);
    await storeConnect().drain(true);
  });

  afterAll(async () => {
    await harness.prisma.storeConnection.deleteMany({});
    await obliterateQueues(harness.app);
    await harness.app.close();
    await harness.prisma.$disconnect();
  });

  it('names the english (u.s.) home of an app with two english pages after a sync and a refresh', async () => {
    const appId = await followingClassB();

    await expect(defaultOf(appId)).resolves.toBe('en-US');
    const items = await localizationsOf(appId);
    expect(items[0]).toMatchObject({
      localization: 'en-US',
      origin: 'home',
      phrases: ['calendar', 'chores'],
      readBy: [{ country: 'de', role: 'default', home: true }],
    });
    expect(items).toContainEqual(
      expect.objectContaining({
        localization: 'en-GB',
        origin: 'detected',
        phrases: ['rota', 'chores'],
      }),
    );
  });

  it('queues the import once the refresh renames the home and tracks its phrases in germany', async () => {
    const appId = await followingClassB();

    const queued = await storeConnect().getJobs(['wait', 'paused', 'delayed']);
    expect(queued).toHaveLength(1);
    await expect(trackedIn(appId, 'de')).resolves.not.toContain('calendar');

    await sync();

    await expect(trackedIn(appId, 'de')).resolves.toContain('calendar');
  });

  it('names english (u.s.) for an app whose only english page is english (u.s.) in the console', async () => {
    registry.listings.set('de:default', US_PAGE);
    const appId = await importFrom();
    await expect(defaultOf(appId)).resolves.toBe('en-GB');
    await follow(appId);
    scriptConsole([
      {
        locale: 'en-US',
        keywords: 'calendar,chores',
        description: US_PAGE.description,
      },
    ]);

    await sync();
    await refresh(appId);

    await expect(defaultOf(appId)).resolves.toBe('en-US');
    const items = await localizationsOf(appId);
    expect(items[0]).toMatchObject({
      localization: 'en-US',
      origin: 'home',
      phrases: ['calendar', 'chores'],
    });
    expect(items.map((item) => item.localization)).not.toContain('en-GB');
  });

  it('returns to the storefront default once the app stops following the console', async () => {
    const appId = await followingClassB();

    await owner.delete(`/apps/${appId}/keyword-fields/import`).expect(204);
    await refresh(appId);

    await expect(defaultOf(appId)).resolves.toBeNull();
    const items = await localizationsOf(appId);
    expect(items[0].localization).toBe('de');
    expect(items).toContainEqual(
      expect.objectContaining({ localization: 'en-GB', origin: 'detected' }),
    );
  });

  it('keeps english (u.s.) while the console shows a newer release than the store page', async () => {
    const appId = await followingClassB();
    scriptConsole(
      [
        {
          locale: 'en-US',
          keywords: 'calendar,chores',
          description: `${US_PAGE.description} Now with meal plans.`,
        },
      ],
      '5.0',
    );

    await sync();
    await refresh(appId);

    await expect(defaultOf(appId)).resolves.toBe('en-US');
  });

  it('falls back to the store alone when the console text differs on the same version', async () => {
    const appId = await followingClassB();
    scriptConsole([
      {
        locale: 'en-US',
        keywords: 'calendar,chores',
        description: `${US_PAGE.description} Now with meal plans.`,
      },
    ]);

    await sync();
    await refresh(appId);

    await expect(defaultOf(appId)).resolves.toBeNull();
  });
});
