import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  WorkspaceContext,
  WorkspaceScope,
} from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { checkJobId, JOBS, utcDateKey } from '../jobs/jobs.types';
import { FirstRunScheduler } from './first-run.scheduler';

const WORKSPACE_ID = 'ws_first_run';
const CORRELATION_ID = 'corr_first_run';
const APP_ID = 'app_1';

type AddCall = [
  string,
  { keywordId: string } & WorkspaceScope,
  { jobId: string },
];

interface TrackedRow {
  keywordId: string;
  keyword: { store: Store };
}

const trackedRow = (keywordId: string, store: Store): TrackedRow => ({
  keywordId,
  keyword: { store },
});

const queueDouble = () => ({
  add: jest.fn<Promise<void>, AddCall>().mockResolvedValue(undefined),
});

const keywordIdsOf = (queue: ReturnType<typeof queueDouble>): string[] =>
  queue.add.mock.calls.map((call) => call[1].keywordId);

function schedulerWith(tracked: TrackedRow[]) {
  const findMany = jest.fn<Promise<TrackedRow[]>, [unknown]>();
  findMany.mockResolvedValue(tracked);
  const appStore = queueDouble();
  const gplay = queueDouble();
  const workspace = new WorkspaceContext();
  const scheduler = new FirstRunScheduler(
    { trackedKeyword: { findMany } } as unknown as PrismaService,
    appStore as unknown as Queue,
    gplay as unknown as Queue,
    workspace,
  );

  const inWorkspace = <T>(work: () => Promise<T>): Promise<T> =>
    workspace.runScope(
      { workspaceId: WORKSPACE_ID, correlationId: CORRELATION_ID },
      work,
    );

  return { scheduler, findMany, appStore, gplay, inWorkspace };
}

describe('FirstRunScheduler', () => {
  it('checks every active tracked keyword in extraction order', async () => {
    const { scheduler, findMany, appStore, inWorkspace } = schedulerWith([
      trackedRow('k1', Store.APP_STORE),
      trackedRow('k2', Store.APP_STORE),
    ]);

    const schedule = await inWorkspace(() => scheduler.schedule(APP_ID));

    expect(schedule).toEqual({ ranked: 2 });
    expect(findMany).toHaveBeenCalledWith({
      where: { appId: APP_ID, active: true },
      select: { keywordId: true, keyword: { select: { store: true } } },
      orderBy: { createdAt: 'asc' },
    });
    expect(keywordIdsOf(appStore)).toEqual(['k1', 'k2']);
  });

  it('reuses the identifier the daily run builds so a same-day run is a no-op', async () => {
    const { scheduler, appStore, inWorkspace } = schedulerWith([
      trackedRow('k1', Store.APP_STORE),
    ]);

    await inWorkspace(() => scheduler.schedule(APP_ID));

    expect(appStore.add).toHaveBeenCalledWith(
      JOBS.CHECK_KEYWORD,
      {
        keywordId: 'k1',
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
      },
      { jobId: checkJobId('k1', utcDateKey()) },
    );
  });

  it('routes each keyword onto the queue for its own store', async () => {
    const { scheduler, appStore, gplay, inWorkspace } = schedulerWith([
      trackedRow('k1', Store.APP_STORE),
      trackedRow('k2', Store.GOOGLE_PLAY),
    ]);

    await inWorkspace(() => scheduler.schedule(APP_ID));

    expect(keywordIdsOf(appStore)).toEqual(['k1']);
    expect(keywordIdsOf(gplay)).toEqual(['k2']);
  });

  it('enqueues nothing for an app with no active tracked keywords', async () => {
    const { scheduler, appStore, gplay, inWorkspace } = schedulerWith([]);

    const schedule = await inWorkspace(() => scheduler.schedule(APP_ID));

    expect(schedule).toEqual({ ranked: 0 });
    expect(appStore.add).not.toHaveBeenCalled();
    expect(gplay.add).not.toHaveBeenCalled();
  });

  it('refuses to schedule without a workspace in scope', async () => {
    const { scheduler } = schedulerWith([trackedRow('k1', Store.APP_STORE)]);

    await expect(scheduler.schedule(APP_ID)).rejects.toThrow(
      'the first run of an imported app',
    );
  });
});
