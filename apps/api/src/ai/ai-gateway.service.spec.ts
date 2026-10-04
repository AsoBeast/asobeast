import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { APIConnectionError } from 'openai';
import { PLAN_LIMITS, type PlanLimit } from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { AiAllowanceExceededError } from './ai-allowance.errors';
import { aiCompletion } from './ai-completion.fixture';
import { AiGateway, type AiCallRequest } from './ai-gateway.service';
import {
  AiStructuredRequest,
  UnusableAnswerError,
  classifyRequestError,
} from './openai.client';

const USAGE = { inputTokens: 900, cachedInputTokens: 100, outputTokens: 120 };

const CALL: AiCallRequest = {
  feature: 'actionExplanation',
  appId: 'app_1',
  userId: 'usr_1',
};

const REQUEST: AiStructuredRequest = {
  system: 'system',
  content: [{ type: 'text', text: 'hello' }],
  schema: { name: 'test', schema: { type: 'object' } },
};

const neverAnswered = () =>
  classifyRequestError(new APIConnectionError({ message: 'down' }), 'gpt-test');

describe('AiGateway', () => {
  const build = (limit: PlanLimit = 200, used = 10) => {
    const executeRaw = jest.fn<Promise<number>, unknown[]>(() =>
      Promise.resolve(1),
    );
    const count = jest.fn(() => Promise.resolve(used));
    const create = jest.fn(() => Promise.resolve({ id: 'call_1' }));
    const updateMany = jest.fn(() => Promise.resolve({ count: 1 }));
    const tx = { $executeRaw: executeRaw, aiCall: { count, create } };
    const prisma = {
      aiCall: { count, updateMany },
      withTransaction: <T>(
        run: (inner: Prisma.TransactionClient) => Promise<T>,
      ) => run(tx as unknown as Prisma.TransactionClient),
    };
    const quota = {
      enforced: true,
      planScope: jest.fn(() =>
        Promise.resolve({
          plan: 'indie',
          limits: { ...PLAN_LIMITS.indie, aiCallsPerMonth: limit },
        }),
      ),
    };
    const structured = jest.fn();
    const gateway = new AiGateway(
      { model: 'gpt-test', structured },
      prisma as unknown as PrismaService,
      { require: () => 'ws_1' } as unknown as WorkspaceContext,
      quota as unknown as QuotaService,
    );
    return { gateway, executeRaw, count, create, updateMany, structured };
  };

  afterEach(() => jest.restoreAllMocks());

  it.each([200, null])(
    'counts the call and records its tokens when the model answers (limit %s)',
    async (limit) => {
      const { gateway, executeRaw, count, create, updateMany, structured } =
        build(limit);
      const completion = aiCompletion({ ok: true }, USAGE);
      structured.mockResolvedValue(completion);

      await expect(gateway.spend(CALL, REQUEST)).resolves.toBe(completion);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ...CALL,
            workspaceId: 'ws_1',
            model: 'gpt-test',
            status: 'reserved',
          }) as unknown,
        }),
      );
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'call_1', status: { not: 'counted' } },
        data: expect.objectContaining({
          status: 'counted',
          ...USAGE,
        }) as unknown,
      });
      if (limit === null) {
        expect(executeRaw).not.toHaveBeenCalled();
        expect(count).not.toHaveBeenCalled();
      } else {
        const [strings] = executeRaw.mock.calls[0] as [TemplateStringsArray];
        expect(strings[0]).toContain('pg_advisory_xact_lock');
        expect(count).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('counts the call and rethrows when the answer is unusable', async () => {
    const { gateway, updateMany, structured } = build();
    const unusable = new UnusableAnswerError('x', false, USAGE);
    structured.mockRejectedValue(unusable);

    await expect(gateway.spend(CALL, REQUEST)).rejects.toBe(unusable);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'call_1', status: { not: 'counted' } },
      data: expect.objectContaining({
        status: 'counted',
        ...USAGE,
      }) as unknown,
    });
  });

  it('never releases an unusable answer whose count could not be recorded', async () => {
    const { gateway, updateMany, structured } = build();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const unusable = new UnusableAnswerError('x', false, USAGE);
    structured.mockRejectedValue(unusable);
    updateMany.mockRejectedValueOnce(new Error('database blip'));

    await expect(gateway.spend(CALL, REQUEST)).rejects.toBe(unusable);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'call_1', status: 'reserved' } }),
    );
  });

  it('releases the call and rethrows when the model never answered', async () => {
    const { gateway, updateMany, structured } = build();
    const failure = neverAnswered();
    structured.mockRejectedValue(failure);

    await expect(gateway.spend(CALL, REQUEST)).rejects.toBe(failure);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'call_1', status: 'reserved' },
      data: expect.objectContaining({ status: 'released' }) as unknown,
    });
  });

  it('leaves a charged reservation reserved when the model never answered', async () => {
    const { gateway, updateMany, structured } = build();
    const failure = neverAnswered();
    structured.mockRejectedValue(failure);

    await expect(gateway.charge('call_1', REQUEST)).rejects.toBe(failure);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('returns the answer when recording it fails', async () => {
    const { gateway, updateMany, structured } = build();
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const completion = aiCompletion({ ok: true }, USAGE);
    structured.mockResolvedValue(completion);
    updateMany.mockRejectedValue(new Error('database down'));

    await expect(gateway.spend(CALL, REQUEST)).resolves.toBe(completion);

    expect(logged).toHaveBeenCalled();
  });

  it('rethrows the original failure when releasing fails', async () => {
    const { gateway, updateMany, structured } = build();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const failure = neverAnswered();
    structured.mockRejectedValue(failure);
    updateMany.mockRejectedValue(new Error('database down'));

    await expect(gateway.spend(CALL, REQUEST)).rejects.toBe(failure);
  });

  it('refuses the first call of a zero allowance without writing a row', async () => {
    const { gateway, create, structured } = build(0, 0);

    const refusal = await gateway
      .reserve(CALL)
      .catch((thrown: unknown) => thrown);

    expect(refusal).toBeInstanceOf(AiAllowanceExceededError);
    expect((refusal as AiAllowanceExceededError).detail.limit).toBe(0);
    expect(create).not.toHaveBeenCalled();
    expect(structured).not.toHaveBeenCalled();
  });

  it('says AI is off for a zero allowance instead of promising a renewal', async () => {
    const { gateway } = build(0, 4);

    const refusal = await gateway
      .reserve(CALL, new Date('2026-10-17T09:00:00.000Z'))
      .catch((thrown: unknown) => thrown);

    expect((refusal as AiAllowanceExceededError).message).toBe(
      'This workspace includes no AI calls.',
    );
    expect((refusal as AiAllowanceExceededError).retryAfterSeconds).toBe(
      1_263_600,
    );
  });

  it('words a refusal without naming a plan, which self hosted has none of', async () => {
    const { gateway } = build(1, 1);

    const refusal = await gateway
      .reserve(CALL, new Date('2026-10-17T09:00:00.000Z'))
      .catch((thrown: unknown) => thrown);

    expect((refusal as AiAllowanceExceededError).message).toBe(
      'The monthly AI allowance is spent: 1 of 1 calls used. It renews at 2026-11-01T00:00:00.000Z.',
    );
  });
});
