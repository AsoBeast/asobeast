import { Job, UnrecoverableError } from 'bullmq';
import { AiRequestError } from '../ai/openai.client';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JobWorkspaceMissingError } from '../jobs/job-workspace';
import { AuditCreativePayload } from '../jobs/jobs.types';
import { AuditAiRunsService } from './audit-ai-runs.service';
import { AuditCreativeWorker } from './audit-creative.worker';

const WORKSPACE = 'ws-1';

const workspace = {
  runScope: <T>(_scope: unknown, work: () => Promise<T>) => work(),
} as unknown as WorkspaceContext;

const job = (
  overrides: Partial<{
    appId: string;
    workspaceId?: string;
    attemptsMade: number;
    attempts: number;
  }> = {},
): Job<AuditCreativePayload> =>
  ({
    name: 'audit-creative',
    id: '1',
    data: {
      appId: overrides.appId ?? 'a',
      workspaceId:
        'workspaceId' in overrides ? overrides.workspaceId : WORKSPACE,
    },
    attemptsMade: overrides.attemptsMade ?? 1,
    opts: { attempts: overrides.attempts ?? 2 },
  }) as unknown as Job<AuditCreativePayload>;

const build = () => {
  const execute = jest.fn().mockResolvedValue(undefined);
  const fail = jest.fn().mockResolvedValue(undefined);
  const worker = new AuditCreativeWorker(
    { execute, fail } as unknown as AuditAiRunsService,
    workspace,
  );
  return { worker, execute, fail };
};

describe('AuditCreativeWorker.process', () => {
  it('executes the run inside the job workspace', async () => {
    const { worker, execute } = build();

    await worker.process(job());

    expect(execute).toHaveBeenCalledWith('a');
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

    await worker.onFailed(
      job({ attemptsMade: 1, attempts: 2 }),
      new Error('OpenAI is rate limiting requests.'),
    );
    expect(fail).not.toHaveBeenCalled();

    await worker.onFailed(
      job({ attemptsMade: 2, attempts: 2 }),
      new Error('OpenAI is rate limiting requests.'),
    );
    expect(fail).toHaveBeenCalledWith('a', 'OpenAI is rate limiting requests.');

    await worker.onFailed(
      job({ attemptsMade: 1, attempts: 2 }),
      new UnrecoverableError(
        'OpenAI rejected the API key. Check OPENAI_API_KEY.',
      ),
    );
    expect(fail).toHaveBeenLastCalledWith(
      'a',
      'OpenAI rejected the API key. Check OPENAI_API_KEY.',
    );
  });

  it('ignores a failure without a job', async () => {
    const { worker, fail } = build();

    await worker.onFailed(undefined, new Error('boom'));

    expect(fail).not.toHaveBeenCalled();
  });
});
