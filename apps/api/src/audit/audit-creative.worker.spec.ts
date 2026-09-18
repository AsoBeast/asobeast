import { Job, UnrecoverableError } from 'bullmq';
import { AiRequestError } from '../ai/openai.client';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JobWorkspaceMissingError } from '../jobs/job-workspace';
import { AuditCreativePayload } from '../jobs/jobs.types';
import { AuditAiRunsService } from './audit-ai-runs.service';
import { AuditCreativeWorker } from './audit-creative.worker';
import { RUN_UNFINISHED_MESSAGE } from './audit-run-state';

const WORKSPACE = 'ws-1';
const REQUESTED_AT = new Date('2026-09-17T13:50:00.000Z');

const workspace = {
  runScope: <T>(_scope: unknown, work: () => Promise<T>) => work(),
} as unknown as WorkspaceContext;

const job = (
  overrides: Partial<{
    appId: string;
    workspaceId?: string;
    attemptsMade: number;
    attempts: number;
    requestedAt?: string;
  }> = {},
): Job<AuditCreativePayload> =>
  ({
    name: 'audit-creative',
    id: '1',
    data: {
      appId: overrides.appId ?? 'a',
      workspaceId:
        'workspaceId' in overrides ? overrides.workspaceId : WORKSPACE,
      requestedAt:
        'requestedAt' in overrides
          ? overrides.requestedAt
          : REQUESTED_AT.toISOString(),
    },
    updateData: jest.fn().mockResolvedValue(undefined),
    attemptsMade: overrides.attemptsMade ?? 1,
    opts: { attempts: overrides.attempts ?? 2 },
  }) as unknown as Job<AuditCreativePayload>;

const build = () => {
  const start = jest.fn().mockResolvedValue(REQUESTED_AT);
  const execute = jest.fn().mockResolvedValue(undefined);
  const fail = jest.fn().mockResolvedValue(undefined);
  const worker = new AuditCreativeWorker(
    { start, execute, fail } as unknown as AuditAiRunsService,
    workspace,
  );
  return { worker, start, execute, fail };
};

describe('AuditCreativeWorker.process', () => {
  it('claims the run, remembers it on the job and executes it', async () => {
    const { worker, execute } = build();
    const queued = job({ requestedAt: undefined });
    const updateData = jest.spyOn(queued, 'updateData');

    await worker.process(queued);

    expect(updateData).toHaveBeenCalledWith(
      expect.objectContaining({ requestedAt: REQUESTED_AT.toISOString() }),
    );
    expect(execute).toHaveBeenCalledWith('a', REQUESTED_AT);
  });

  it('does nothing when no run is waiting', async () => {
    const { worker, start, execute } = build();
    start.mockResolvedValue(null);

    await worker.process(job());

    expect(execute).not.toHaveBeenCalled();
  });

  it('rethrows a retryable failure and turns a final one into an unrecoverable error', async () => {
    const { worker, execute } = build();

    execute.mockRejectedValueOnce(
      new AiRequestError('OpenAI is rate limiting requests.', true),
    );
    await expect(worker.process(job())).rejects.toBeInstanceOf(AiRequestError);

    execute.mockRejectedValueOnce(
      new AiRequestError(
        'OpenAI rejected the API key. Check OPENAI_API_KEY.',
        false,
      ),
    );
    await expect(worker.process(job())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('refuses a job without a workspace', async () => {
    const { worker } = build();

    await expect(
      worker.process(job({ workspaceId: undefined })),
    ).rejects.toBeInstanceOf(JobWorkspaceMissingError);
  });
});

describe('AuditCreativeWorker.onFailed', () => {
  it('writes the failure only when no attempt is left', async () => {
    const { worker, fail } = build();
    const rateLimited = new AiRequestError(
      'OpenAI is rate limiting requests.',
      true,
    );

    await worker.onFailed(job({ attemptsMade: 1, attempts: 2 }), rateLimited);
    expect(fail).not.toHaveBeenCalled();

    await worker.onFailed(job({ attemptsMade: 2, attempts: 2 }), rateLimited);
    expect(fail).toHaveBeenCalledWith(
      'a',
      REQUESTED_AT,
      'OpenAI is rate limiting requests.',
    );
  });

  it('records the message of a refused request after one attempt', async () => {
    const { worker, execute, fail } = build();
    execute.mockRejectedValueOnce(
      new AiRequestError(
        'OpenAI rejected the API key. Check OPENAI_API_KEY.',
        false,
      ),
    );
    const refused = await worker.process(job()).catch((error: Error) => error);

    await worker.onFailed(
      job({ attemptsMade: 1, attempts: 2 }),
      refused as Error,
    );

    expect(fail).toHaveBeenCalledWith(
      'a',
      REQUESTED_AT,
      'OpenAI rejected the API key. Check OPENAI_API_KEY.',
    );
  });

  it('never shows an internal error message to the owner', async () => {
    const { worker, fail } = build();

    await worker.onFailed(
      job({ attemptsMade: 2, attempts: 2 }),
      new Error('Invalid `prisma.auditInsight.upsert()` invocation'),
    );

    expect(fail).toHaveBeenCalledWith(
      'a',
      REQUESTED_AT,
      RUN_UNFINISHED_MESSAGE,
    );
  });

  it('ignores a failure without a job or before the run was claimed', async () => {
    const { worker, fail } = build();

    await worker.onFailed(undefined, new Error('boom'));
    await worker.onFailed(
      job({ attemptsMade: 2, attempts: 2, requestedAt: undefined }),
      new Error('boom'),
    );

    expect(fail).not.toHaveBeenCalled();
  });
});
