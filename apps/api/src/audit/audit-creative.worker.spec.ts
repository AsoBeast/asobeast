import { Job, UnrecoverableError } from 'bullmq';
import { AiAllowanceExceededError } from '../ai/ai-allowance.errors';
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
    aiCallId: string;
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
      aiCallId: overrides.aiCallId,
    },
    attemptsMade: overrides.attemptsMade ?? 1,
    opts: { attempts: overrides.attempts ?? 2 },
  }) as unknown as Job<AuditCreativePayload>;

const build = () => {
  const start = jest.fn().mockResolvedValue(true);
  const execute = jest.fn().mockResolvedValue(undefined);
  const fail = jest.fn().mockResolvedValue(undefined);
  const abandon = jest.fn().mockResolvedValue(undefined);
  const worker = new AuditCreativeWorker(
    { start, execute, fail, abandon } as unknown as AuditAiRunsService,
    workspace,
  );
  return { worker, start, execute, fail, abandon };
};

describe('AuditCreativeWorker.process', () => {
  it('claims the run it was queued for and executes it', async () => {
    const { worker, start, execute } = build();

    await worker.process(job());

    expect(start).toHaveBeenCalledWith('a', REQUESTED_AT);
    expect(execute).toHaveBeenCalledWith('a', REQUESTED_AT, undefined);
  });

  it('does nothing when its run was replaced or already finished', async () => {
    const { worker, start, execute } = build();
    start.mockResolvedValue(false);

    await worker.process(job());

    expect(execute).not.toHaveBeenCalled();
  });

  it('ignores a job without a readable request time', async () => {
    const { worker, start } = build();

    await worker.process(job({ requestedAt: 'not a date' }));

    expect(start).not.toHaveBeenCalled();
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

describe('AuditCreativeWorker reservations', () => {
  it('executes the run with its reservation', async () => {
    const { worker, execute } = build();

    await worker.process(job({ aiCallId: 'call_1' }));

    expect(execute).toHaveBeenCalledWith('a', REQUESTED_AT, 'call_1');
  });

  it('charges the same reservation on a retried attempt', async () => {
    const { worker, execute } = build();
    execute.mockRejectedValueOnce(
      new AiRequestError('Could not reach OpenAI.', true),
    );

    await expect(
      worker.process(job({ aiCallId: 'call_1', attemptsMade: 0 })),
    ).rejects.toBeInstanceOf(AiRequestError);
    await worker.process(job({ aiCallId: 'call_1', attemptsMade: 1 }));

    expect(execute.mock.calls).toEqual([
      ['a', REQUESTED_AT, 'call_1'],
      ['a', REQUESTED_AT, 'call_1'],
    ]);
  });

  it('releases the reservation when the final attempt fails', async () => {
    const { worker, fail } = build();

    await worker.onFailed(
      job({ aiCallId: 'call_1', attemptsMade: 2, attempts: 2 }),
      new AiRequestError('Could not reach OpenAI.', true),
    );

    expect(fail).toHaveBeenCalledWith(
      'a',
      REQUESTED_AT,
      'Could not reach OpenAI.',
      'call_1',
    );
  });

  it('releases the reservation of a superseded run', async () => {
    const { worker, start, execute, abandon } = build();
    start.mockResolvedValue(false);

    await worker.process(job({ aiCallId: 'call_1' }));

    expect(abandon).toHaveBeenCalledWith('call_1');
    expect(execute).not.toHaveBeenCalled();
  });

  it('reserves when a job queued before the allowance executes', async () => {
    const { worker, execute } = build();

    await worker.process(job());

    expect(execute).toHaveBeenCalledWith('a', REQUESTED_AT, undefined);
  });

  it('fails at once with the allowance message when that reservation is refused', async () => {
    const { worker, execute } = build();
    const refusal = new AiAllowanceExceededError(
      {
        plan: 'indie',
        limit: 200,
        used: 200,
        resetsAt: '2026-10-01T00:00:00.000Z',
        upgradeTo: 'ultimate',
      },
      60,
    );
    execute.mockRejectedValueOnce(refusal);

    const failure = await worker
      .process(job())
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UnrecoverableError);
    expect((failure as Error).message).toBe(refusal.message);
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
      undefined,
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
      undefined,
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
      undefined,
    );
  });

  it('ignores a failure without a job or a readable request time', async () => {
    const { worker, fail } = build();

    await worker.onFailed(undefined, new Error('boom'));
    await worker.onFailed(
      job({ attemptsMade: 2, attempts: 2, requestedAt: 'not a date' }),
      new Error('boom'),
    );

    expect(fail).not.toHaveBeenCalled();
  });
});
