import { Store } from '@prisma/client';
import { FlowJob, FlowProducer } from 'bullmq';
import {
  WorkspaceContext,
  WorkspaceScope,
} from '../common/tenancy/workspace-context';
import { firstRunCheckJobId, utcDateKey } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { FirstPositionChecks } from './first-position-checks';

const APP_ID = 'app_1';
const SCOPE: WorkspaceScope = {
  workspaceId: 'ws_first_run',
  correlationId: 'corr_first_run',
};

interface TrackedRow {
  keywordId: string;
  keyword: { store: Store };
}

const trackedRow = (keywordId: string, store: Store): TrackedRow => ({
  keywordId,
  keyword: { store },
});

function checksWith(tracked: TrackedRow[]) {
  const findMany = jest.fn<Promise<TrackedRow[]>, [unknown]>();
  findMany.mockResolvedValue(tracked);
  const flowProducer = {
    addBulk: jest.fn<Promise<unknown>, [FlowJob[]]>().mockResolvedValue([]),
  };
  const workspace = new WorkspaceContext();
  const checks = new FirstPositionChecks(
    { trackedKeyword: { findMany } } as unknown as PrismaService,
    flowProducer as unknown as FlowProducer,
    workspace,
  );

  const inWorkspace = <T>(work: () => Promise<T>): Promise<T> =>
    workspace.runScope(SCOPE, work);

  return { checks, findMany, flowProducer, inWorkspace };
}

describe('FirstPositionChecks', () => {
  it('checks only the keywords it is given', async () => {
    const { checks, findMany, flowProducer, inWorkspace } = checksWith([
      trackedRow('k3', Store.APP_STORE),
    ]);

    const queued = await inWorkspace(() => checks.schedule(APP_ID, ['k3']));

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
  });

  it('queues nothing when no keyword was added', async () => {
    const { checks, flowProducer, inWorkspace } = checksWith([]);

    expect(await inWorkspace(() => checks.schedule(APP_ID, []))).toBe(0);
    expect(flowProducer.addBulk).not.toHaveBeenCalled();
  });

  it('refuses to schedule without a workspace in scope', async () => {
    const { checks } = checksWith([trackedRow('k1', Store.APP_STORE)]);

    await expect(checks.schedule(APP_ID, ['k1'])).rejects.toThrow(
      'the first positions of new keywords',
    );
  });
});
