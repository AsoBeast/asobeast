import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AI_NOT_CONFIGURED, AiGateway } from '../ai/ai-gateway.service';
import { aiCompletion } from '../ai/ai-completion.fixture';
import { PrismaService } from '../prisma/prisma.service';
import { ActionsAiService } from './actions-ai.service';

const EVIDENCE = {
  rule: 'keyword.add_uncovered',
  opportunity: 66.5,
  indexedFields: ['title'],
  uncoveredFields: ['title'],
};

const buildPrisma = (
  row: Record<string, unknown> | null = {
    id: 'act_1',
    rule: 'keyword.add_uncovered',
    priority: 'high',
    impact: 71,
    evidence: EVIDENCE,
    appId: 'app_1',
    app: { name: 'Budget', store: 'APP_STORE', country: 'us' },
  },
) => ({
  actionItem: {
    findFirst: jest.fn(() => Promise.resolve(row)),
    update: jest.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve(args.data),
    ),
  },
});

const buildAi = (
  spend: jest.Mock = jest.fn(() =>
    Promise.resolve(
      aiCompletion({ explanation: '  Your title is missing it.  ' }),
    ),
  ),
  configured = true,
) => ({
  configured,
  model: configured ? 'gpt-4o' : null,
  requireModel: jest.fn(() => {
    if (!configured) throw new ConflictException(AI_NOT_CONFIGURED);
    return 'gpt-4o';
  }),
  spend,
});

const serviceFor = (
  prisma: ReturnType<typeof buildPrisma>,
  ai: ReturnType<typeof buildAi> = buildAi(),
): ActionsAiService =>
  new ActionsAiService(
    ai as unknown as AiGateway,
    prisma as unknown as PrismaService,
  );

describe('ActionsAiService.status', () => {
  it('reports the seam as unconfigured without a client', () => {
    expect(
      serviceFor(buildPrisma(), buildAi(undefined, false)).status(),
    ).toEqual({
      configured: false,
      model: null,
    });
  });

  it('reports the configured model when a client exists', () => {
    expect(serviceFor(buildPrisma()).status()).toEqual({
      configured: true,
      model: 'gpt-4o',
    });
  });
});

describe('ActionsAiService.explain', () => {
  it('refuses with 409 when no key is configured', async () => {
    const prisma = buildPrisma();

    await expect(
      serviceFor(prisma, buildAi(undefined, false)).explain('act_1', 'usr_1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.actionItem.findFirst).not.toHaveBeenCalled();
  });

  it('persists a trimmed explanation with its model and timestamp', async () => {
    const prisma = buildPrisma();

    const result = await serviceFor(prisma).explain('act_1', 'usr_1');

    expect(result).toMatchObject({
      explanation: 'Your title is missing it.',
      model: 'gpt-4o',
    });
    expect(prisma.actionItem.update.mock.calls[0][0].data).toMatchObject({
      aiExplanation: 'Your title is missing it.',
      aiModel: 'gpt-4o',
    });
  });

  it('sends only the app, rule, priority, impact and typed evidence', async () => {
    const spend = jest.fn(() =>
      Promise.resolve(aiCompletion({ explanation: 'Fine.' })),
    );
    await serviceFor(buildPrisma(), buildAi(spend)).explain('act_1', 'usr_1');

    const request = spend.mock.calls[0][1] as unknown as {
      system: string;
      content: Array<{ text: string }>;
    };
    expect(request.system).toContain('may not change, question or re-rank');
    expect(request.content[0].text).toContain('Rule: keyword.add_uncovered');
    expect(request.content[0].text).toContain('Estimated impact: 71 of 100');
    expect(request.content[0].text).toContain('opportunity');
    expect(request.content[0].text).not.toContain('workspaceId');
  });

  it('de-duplicates two concurrent explain calls for one action', async () => {
    const spend = jest.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(aiCompletion({ explanation: 'Once.' })), 5),
        ),
    );
    const prisma = buildPrisma();
    const service = serviceFor(prisma, buildAi(spend));

    const [first, second] = await Promise.all([
      service.explain('act_1', 'usr_1'),
      service.explain('act_1', 'usr_1'),
    ]);

    expect(spend).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('allows a fresh call after the in-flight one settles', async () => {
    const spend = jest.fn(() =>
      Promise.resolve(aiCompletion({ explanation: 'Again.' })),
    );
    const service = serviceFor(buildPrisma(), buildAi(spend));

    await service.explain('act_1', 'usr_1');
    await service.explain('act_1', 'usr_1');

    expect(spend).toHaveBeenCalledTimes(2);
  });

  it('rejects an unknown action with 404', async () => {
    await expect(
      serviceFor(buildPrisma(null)).explain('missing', 'usr_1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to explain a degraded action', async () => {
    const prisma = buildPrisma({
      id: 'act_1',
      rule: 'keyword.add_uncovered',
      priority: 'high',
      impact: 71,
      evidence: 'broken',
      app: { name: 'Budget', store: 'APP_STORE', country: 'us' },
    });

    await expect(
      serviceFor(prisma).explain('act_1', 'usr_1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.actionItem.update).not.toHaveBeenCalled();
  });

  it('never persists a malformed or empty model response', async () => {
    for (const output of [{}, { explanation: '' }, null, 'text']) {
      const prisma = buildPrisma();
      const ai = buildAi(jest.fn(() => Promise.resolve(aiCompletion(output))));

      await expect(
        serviceFor(prisma, ai).explain('act_1', 'usr_1'),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(prisma.actionItem.update).not.toHaveBeenCalled();
    }
  });

  it('propagates an upstream failure without persisting anything', async () => {
    const prisma = buildPrisma();
    const ai = buildAi(
      jest.fn(() => Promise.reject(new BadGatewayException('upstream'))),
    );

    await expect(
      serviceFor(prisma, ai).explain('act_1', 'usr_1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.actionItem.update).not.toHaveBeenCalled();
  });

  it('regenerates over a previous explanation', async () => {
    const prisma = buildPrisma();
    const service = serviceFor(
      prisma,
      buildAi(
        jest.fn(() => Promise.resolve(aiCompletion({ explanation: 'Newer.' }))),
      ),
    );

    await service.explain('act_1', 'usr_1');
    await service.explain('act_1', 'usr_1');

    expect(prisma.actionItem.update).toHaveBeenCalledTimes(2);
  });

  it('explains through the gateway on behalf of the requesting user', async () => {
    const ai = buildAi();

    await serviceFor(buildPrisma(), ai).explain('act_1', 'usr_1');

    expect(ai.spend).toHaveBeenCalledTimes(1);
    expect(ai.spend).toHaveBeenCalledWith(
      { feature: 'actionExplanation', appId: 'app_1', userId: 'usr_1' },
      expect.objectContaining({
        schema: expect.objectContaining({
          name: 'action_explanation',
        }) as unknown,
      }),
    );
  });

  it('keeps the call counted when the explanation is blank', async () => {
    const prisma = buildPrisma();
    const ai = buildAi(
      jest.fn(() => Promise.resolve(aiCompletion({ explanation: '   ' }))),
    );

    await expect(
      serviceFor(prisma, ai).explain('act_1', 'usr_1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(ai.spend).toHaveBeenCalledTimes(1);
    expect(prisma.actionItem.update).not.toHaveBeenCalled();
  });

  it('keeps the call counted when storing the explanation fails', async () => {
    const prisma = buildPrisma();
    const stored = new Error('database down');
    prisma.actionItem.update.mockRejectedValue(stored);
    const ai = buildAi();

    await expect(serviceFor(prisma, ai).explain('act_1', 'usr_1')).rejects.toBe(
      stored,
    );
    expect(ai.spend).toHaveBeenCalledTimes(1);
  });
});
