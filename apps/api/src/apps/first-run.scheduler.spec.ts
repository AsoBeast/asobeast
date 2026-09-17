import { Store } from '@prisma/client';
import { FlowJob, FlowJobNode, FlowOpts, FlowProducer } from 'bullmq';
import { ActionRunQueue } from '../actions/action-run.queue';
import {
  WorkspaceContext,
  WorkspaceScope,
} from '../common/tenancy/workspace-context';
import { JOB_OPTIONS } from '../jobs/job-options';
import {
  firstRunCheckJobId,
  JOBS,
  QUEUES,
  utcDateKey,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { FirstRunScheduler } from './first-run.scheduler';

const WORKSPACE_ID = 'ws_first_run';
const CORRELATION_ID = 'corr_first_run';
const APP_ID = 'app_1';
const SCOPE: WorkspaceScope = {
  workspaceId: WORKSPACE_ID,
  correlationId: CORRELATION_ID,
};

interface TrackedRow {
  keywordId: string;
  keyword: { store: Store };
}

const trackedRow = (keywordId: string, store: Store): TrackedRow => ({
  keywordId,
  keyword: { store },
});

function schedulerWith(tracked: TrackedRow[]) {
  const findMany = jest.fn<Promise<TrackedRow[]>, [unknown]>();
  findMany.mockResolvedValue(tracked);
  const flowProducer = {
    add: jest.fn<Promise<unknown>, [FlowJob, FlowOpts]>().mockResolvedValue({}),
    addBulk: jest.fn<Promise<unknown>, [FlowJob[]]>().mockResolvedValue([]),
  };
  const actionRuns = {
    request: jest
      .fn<Promise<{ queued: true; jobId: string }>, [WorkspaceScope]>()
      .mockResolvedValue({ queued: true, jobId: 'run_1' }),
  };
  const workspace = new WorkspaceContext();
  const scheduler = new FirstRunScheduler(
    { trackedKeyword: { findMany } } as unknown as PrismaService,
    flowProducer as unknown as FlowProducer,
    actionRuns as unknown as ActionRunQueue,
    workspace,
  );

  const inWorkspace = <T>(work: () => Promise<T>): Promise<T> =>
    workspace.runScope(SCOPE, work);

  const flow = (call = 0): FlowJob => flowProducer.add.mock.calls[call][0];
  const children = (call = 0): FlowJobNode[] => flow(call).children ?? [];

  return {
    scheduler,
    findMany,
    flowProducer,
    actionRuns,
    inWorkspace,
    flow,
    children,
  };
}

describe('FirstRunScheduler', () => {
  it('checks every active tracked keyword in extraction order', async () => {
    const { scheduler, findMany, children, inWorkspace } = schedulerWith([
      trackedRow('k1', Store.APP_STORE),
      trackedRow('k2', Store.APP_STORE),
    ]);

    const schedule = await inWorkspace(() => scheduler.schedule(APP_ID));

    expect(schedule).toEqual({ ranked: 2, actionsQueued: true });
    expect(findMany).toHaveBeenCalledWith({
      where: { appId: APP_ID, active: true },
      select: { keywordId: true, keyword: { select: { store: true } } },
      orderBy: { createdAt: 'asc' },
    });
    expect(
      children().map(
        (child) => (child.data as { keywordId: string }).keywordId,
      ),
    ).toEqual(['k1', 'k2']);
  });

  it('generates actions only after the first rank checks settle', async () => {
    const { scheduler, flow, actionRuns, inWorkspace } = schedulerWith([
      trackedRow('k1', Store.APP_STORE),
    ]);

    await inWorkspace(() => scheduler.schedule(APP_ID));

    expect(flow()).toMatchObject({
      name: JOBS.ACTIONS,
      queueName: QUEUES.PIPELINE,
      data: SCOPE,
      opts: JOB_OPTIONS,
    });
    expect(flow().opts).not.toHaveProperty('deduplication');
    expect(actionRuns.request).not.toHaveBeenCalled();
  });

  it('names the app in the check identifier and lets a failed check release the run', async () => {
    const { scheduler, children, inWorkspace } = schedulerWith([
      trackedRow('k1', Store.APP_STORE),
    ]);

    await inWorkspace(() => scheduler.schedule(APP_ID));

    expect(children()).toEqual([
      {
        name: JOBS.CHECK_KEYWORD,
        queueName: QUEUES.APP_STORE,
        data: { keywordId: 'k1', ...SCOPE },
        opts: {
          ...JOB_OPTIONS,
          jobId: firstRunCheckJobId(APP_ID, 'k1', utcDateKey()),
          removeDependencyOnFailure: true,
        },
      },
    ]);
  });

  it('gives two apps sharing one keyword a check and a run each', async () => {
    const { scheduler, flowProducer, children, inWorkspace } = schedulerWith([
      trackedRow('shared', Store.APP_STORE),
    ]);

    await inWorkspace(() => scheduler.schedule('app_1'));
    await inWorkspace(() => scheduler.schedule('app_2'));

    expect(flowProducer.add).toHaveBeenCalledTimes(2);
    expect(children(0)[0].opts?.jobId).not.toBe(children(1)[0].opts?.jobId);
  });

  it('routes each keyword onto the queue for its own store', async () => {
    const { scheduler, children, inWorkspace } = schedulerWith([
      trackedRow('k1', Store.APP_STORE),
      trackedRow('k2', Store.GOOGLE_PLAY),
    ]);

    await inWorkspace(() => scheduler.schedule(APP_ID));

    expect(children().map((child) => child.queueName)).toEqual([
      QUEUES.APP_STORE,
      QUEUES.GPLAY,
    ]);
  });

  it('requests a plain action run for an app with no active tracked keywords', async () => {
    const { scheduler, flowProducer, actionRuns, inWorkspace } = schedulerWith(
      [],
    );

    const schedule = await inWorkspace(() => scheduler.schedule(APP_ID));

    expect(schedule).toEqual({ ranked: 0, actionsQueued: true });
    expect(flowProducer.add).not.toHaveBeenCalled();
    expect(actionRuns.request).toHaveBeenCalledWith(SCOPE);
  });

  it('checks only the keywords it is given, without a second actions run', async () => {
    const { scheduler, findMany, flowProducer, actionRuns, inWorkspace } =
      schedulerWith([trackedRow('k3', Store.APP_STORE)]);

    const queued = await inWorkspace(() =>
      scheduler.checkKeywords(APP_ID, ['k3']),
    );

    expect(queued).toBe(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { appId: APP_ID, active: true, keywordId: { in: ['k3'] } },
      }),
    );
    const [jobs] = flowProducer.addBulk.mock.calls[0];
    expect(jobs.map((job) => job.opts?.jobId)).toEqual([
      firstRunCheckJobId(APP_ID, 'k3', utcDateKey()),
    ]);
    expect(flowProducer.add).not.toHaveBeenCalled();
    expect(actionRuns.request).not.toHaveBeenCalled();
  });

  it('queues nothing when no keyword was added', async () => {
    const { scheduler, flowProducer, inWorkspace } = schedulerWith([]);

    expect(await inWorkspace(() => scheduler.checkKeywords(APP_ID, []))).toBe(
      0,
    );
    expect(flowProducer.addBulk).not.toHaveBeenCalled();
  });

  it('refuses to schedule without a workspace in scope', async () => {
    const { scheduler } = schedulerWith([trackedRow('k1', Store.APP_STORE)]);

    await expect(scheduler.schedule(APP_ID)).rejects.toThrow(
      'the first run of an imported app',
    );
  });
});
