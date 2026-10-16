import { Store } from '@prisma/client';
import { Job, UnrecoverableError } from 'bullmq';
import { AppsService } from '../apps/apps.service';
import { LocalizationDetection } from '../apps/localization-detection.service';
import { SubtitleBackfill } from '../apps/subtitle-backfill.service';
import { CollectionEligibility } from '../auth/collection-eligibility.service';
import { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { SpiderService } from '../keywords/spider.service';
import { RankingsService } from '../rankings/rankings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { ScoringService } from '../scoring/scoring.service';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { JobTargetCountry } from './job-target-country';
import { JobWorkspaceMissingError } from './job-workspace';
import { JOBS, QUEUES } from './jobs.types';
import { StoreJobsHandler } from './store-jobs.handler';

describe('StoreJobsHandler', () => {
  const refreshApp = jest.fn();
  const refreshListing = jest.fn();
  const resolveSubtitle = jest.fn();
  const runSpiderProbe = jest.fn();
  const probeLocalization = jest.fn();
  const checkCategory = jest.fn().mockResolvedValue(undefined);
  const forWorkspace = jest.fn<Promise<boolean>, []>();
  const through = jest.fn(
    (_store: Store, _country: string | undefined, work: () => Promise<void>) =>
      work(),
  );
  const countryOf = jest.fn<Promise<string | undefined>, [Job]>();
  const workspace = new WorkspaceContext();
  let seen: string | undefined;
  let handler: StoreJobsHandler;

  beforeEach(() => {
    seen = undefined;
    through.mockClear();
    countryOf.mockReset().mockResolvedValue('us');
    runSpiderProbe.mockReset().mockResolvedValue(undefined);
    probeLocalization.mockReset().mockResolvedValue(undefined);
    forWorkspace.mockReset().mockResolvedValue(true);
    refreshListing.mockReset().mockResolvedValue(null);
    refreshApp.mockReset().mockImplementation(() => {
      seen = workspace.current;
      return Promise.resolve();
    });
    handler = new StoreJobsHandler(
      { refreshApp, refreshListing } as unknown as AppsService,
      {} as RankingsService,
      {} as ScoringService,
      { checkCategory } as unknown as CategoryRanksService,
      {} as ReviewsService,
      { runSpiderProbe } as unknown as SpiderService,
      workspace,
      { through } as unknown as ProxyEgress,
      { of: countryOf } as unknown as JobTargetCountry,
      { resolve: resolveSubtitle } as unknown as SubtitleBackfill,
      { forWorkspace } as unknown as CollectionEligibility,
      { probe: probeLocalization } as unknown as LocalizationDetection,
    );
  });

  function job(data: unknown, queueName = QUEUES.APP_STORE): Job {
    return { name: JOBS.REFRESH_APP, id: '1', data, queueName } as Job;
  }

  it('passes the final attempt of the job to the category check', async () => {
    const payload = {
      collection: 'paid',
      genre: 'SHOPPING',
      country: 'pl',
      store: Store.GOOGLE_PLAY,
      workspaceId: 'ws_a',
    };
    const chartJob = (attemptsMade: number) =>
      ({
        ...job(payload, QUEUES.GPLAY),
        name: JOBS.CHECK_CATEGORY,
        attemptsMade,
        opts: { attempts: 3 },
      }) as Job;

    await handler.handle(chartJob(0));
    await handler.handle(chartJob(2));

    expect(checkCategory).toHaveBeenNthCalledWith(1, payload, false);
    expect(checkCategory).toHaveBeenNthCalledWith(2, payload, true);
  });

  it('runs the job inside the workspace its payload carries', async () => {
    await handler.handle(job({ appId: 'a1', workspaceId: 'ws_a' }));

    expect(refreshApp).toHaveBeenCalledWith('a1');
    expect(seen).toBe('ws_a');
  });

  it('refreshes a market listing when the payload names a market', async () => {
    await handler.handle(
      job({ appId: 'a1', country: 'de', workspaceId: 'ws_a' }),
    );

    expect(refreshListing).toHaveBeenCalledWith('a1', 'de');
    expect(refreshApp).not.toHaveBeenCalled();
  });

  it('fails the job instead of defaulting when the workspace is absent', async () => {
    await expect(handler.handle(job({ appId: 'a1' }))).rejects.toThrow(
      JobWorkspaceMissingError,
    );
    expect(refreshApp).not.toHaveBeenCalled();
  });

  it('leaves no workspace in scope once the job finishes', async () => {
    await handler.handle(job({ appId: 'a1', workspaceId: 'ws_a' }));

    expect(workspace.current).toBeUndefined();
  });

  it('holds one egress endpoint for the whole job rather than one per request', async () => {
    await handler.handle(job({ appId: 'a1', workspaceId: 'ws_a' }));

    expect(through).toHaveBeenCalledTimes(1);
    expect(through).toHaveBeenCalledWith(
      Store.APP_STORE,
      'us',
      expect.any(Function) as () => Promise<void>,
    );
  });

  it('routes a play job through the store its queue serves', async () => {
    await handler.handle(
      job({ appId: 'a1', workspaceId: 'ws_a' }, QUEUES.GPLAY),
    );

    expect(through.mock.calls[0][0]).toBe(Store.GOOGLE_PLAY);
  });

  it('dispatches a subtitle backfill with its payload', async () => {
    const data = { appId: 'a1', snapshotId: 's1', workspaceId: 'ws_a' };

    await handler.handle({
      name: JOBS.RESOLVE_SUBTITLE,
      id: '2',
      data,
      queueName: QUEUES.APP_STORE,
    } as Job);

    expect(resolveSubtitle).toHaveBeenCalledWith(data);
  });

  describe('a deep search probe', () => {
    const probe = {
      name: JOBS.SPIDER_PROBE,
      id: '4',
      data: { appId: 'a1', term: 't', probe: 'a', workspaceId: 'ws_a' },
      queueName: QUEUES.APP_STORE,
    } as Job;

    it('runs through one egress endpoint while its workspace may collect', async () => {
      await handler.handle(probe);

      expect(through).toHaveBeenCalledTimes(1);
      expect(runSpiderProbe).toHaveBeenCalledWith(probe.data);
    });

    it('takes no egress endpoint once its workspace may no longer collect', async () => {
      forWorkspace.mockResolvedValue(false);

      await handler.handle(probe);

      expect(through).not.toHaveBeenCalled();
      expect(runSpiderProbe).not.toHaveBeenCalled();
    });
  });

  describe('a localization probe', () => {
    const detect = {
      name: JOBS.DETECT_LOCALIZATION,
      id: '5',
      data: {
        appId: 'a1',
        localization: 'es-MX',
        country: 'mx',
        workspaceId: 'ws_a',
      },
      queueName: QUEUES.APP_STORE,
    } as Job;

    it('runs through one egress endpoint while its workspace may collect', async () => {
      await handler.handle(detect);

      expect(through).toHaveBeenCalledTimes(1);
      expect(probeLocalization).toHaveBeenCalledWith(detect.data);
    });

    it('takes no egress endpoint once its workspace may no longer collect', async () => {
      forWorkspace.mockResolvedValue(false);

      await handler.handle(detect);

      expect(through).not.toHaveBeenCalled();
      expect(probeLocalization).not.toHaveBeenCalled();
    });

    it('runs the probe inside the workspace its payload carries', async () => {
      probeLocalization.mockImplementation(() => {
        seen = workspace.current;
        return Promise.resolve();
      });

      await handler.handle(detect);

      expect(seen).toBe('ws_a');
    });

    it('fails a probe whose payload carries no workspace', async () => {
      await expect(
        handler.handle({ ...detect, data: { appId: 'a1' } } as Job),
      ).rejects.toBeInstanceOf(JobWorkspaceMissingError);
      expect(probeLocalization).not.toHaveBeenCalled();
    });
  });

  it('asks whether the workspace may collect only for a deferred job', async () => {
    forWorkspace.mockResolvedValue(false);

    await handler.handle(job({ appId: 'a1', workspaceId: 'ws_a' }));

    expect(forWorkspace).not.toHaveBeenCalled();
    expect(refreshApp).toHaveBeenCalledWith('a1');
  });

  it.each([
    ['no app id', { snapshotId: 's1' }],
    ['an empty app id', { appId: '', snapshotId: 's1' }],
    ['no snapshot id', { appId: 'a1' }],
    ['a numeric snapshot id', { appId: 'a1', snapshotId: 1 }],
  ])(
    'refuses a subtitle backfill with %s instead of patching an unknown app',
    async (_case, ids) => {
      resolveSubtitle.mockClear();

      await expect(
        handler.handle({
          name: JOBS.RESOLVE_SUBTITLE,
          id: '3',
          data: { ...ids, workspaceId: 'ws_a' },
          queueName: QUEUES.APP_STORE,
        } as Job),
      ).rejects.toBeInstanceOf(UnrecoverableError);
      expect(resolveSubtitle).not.toHaveBeenCalled();
    },
  );
});
