import { Store } from '@prisma/client';
import { Job } from 'bullmq';
import { AppsService } from '../apps/apps.service';
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
    refreshApp.mockReset().mockImplementation(() => {
      seen = workspace.current;
      return Promise.resolve();
    });
    handler = new StoreJobsHandler(
      { refreshApp } as unknown as AppsService,
      {} as RankingsService,
      {} as ScoringService,
      {} as CategoryRanksService,
      {} as ReviewsService,
      {} as SpiderService,
      workspace,
      { through } as unknown as ProxyEgress,
      { of: countryOf } as unknown as JobTargetCountry,
    );
  });

  function job(data: unknown, queueName = QUEUES.APP_STORE): Job {
    return { name: JOBS.REFRESH_APP, id: '1', data, queueName } as Job;
  }

  it('runs the job inside the workspace its payload carries', async () => {
    await handler.handle(job({ appId: 'a1', workspaceId: 'ws_a' }));

    expect(refreshApp).toHaveBeenCalledWith('a1');
    expect(seen).toBe('ws_a');
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
});
