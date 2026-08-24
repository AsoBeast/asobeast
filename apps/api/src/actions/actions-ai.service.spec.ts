import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AiClient } from '../ai/openai.client';
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

const buildClient = (
  structured: jest.Mock = jest.fn(() =>
    Promise.resolve({ explanation: '  Your title is missing it.  ' }),
  ),
): AiClient => ({ model: 'gpt-4o', structured });

const serviceFor = (
  prisma: ReturnType<typeof buildPrisma>,
  client: AiClient | null = buildClient(),
): ActionsAiService =>
  new ActionsAiService(client, prisma as unknown as PrismaService);

describe('ActionsAiService.status', () => {
  it('reports the seam as unconfigured without a client', () => {
    expect(serviceFor(buildPrisma(), null).status()).toEqual({
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
      serviceFor(prisma, null).explain('act_1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.actionItem.findFirst).not.toHaveBeenCalled();
  });

  it('persists a trimmed explanation with its model and timestamp', async () => {
    const prisma = buildPrisma();

    const result = await serviceFor(prisma).explain('act_1');

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
    const structured = jest.fn(() => Promise.resolve({ explanation: 'Fine.' }));
    await serviceFor(buildPrisma(), buildClient(structured)).explain('act_1');

    const request = structured.mock.calls[0][0] as unknown as {
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
    const structured = jest.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ explanation: 'Once.' }), 5),
        ),
    );
    const prisma = buildPrisma();
    const service = serviceFor(prisma, buildClient(structured));

    const [first, second] = await Promise.all([
      service.explain('act_1'),
      service.explain('act_1'),
    ]);

    expect(structured).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('allows a fresh call after the in-flight one settles', async () => {
    const structured = jest.fn(() =>
      Promise.resolve({ explanation: 'Again.' }),
    );
    const service = serviceFor(buildPrisma(), buildClient(structured));

    await service.explain('act_1');
    await service.explain('act_1');

    expect(structured).toHaveBeenCalledTimes(2);
  });

  it('rejects an unknown action with 404', async () => {
    await expect(
      serviceFor(buildPrisma(null)).explain('missing'),
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

    await expect(serviceFor(prisma).explain('act_1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.actionItem.update).not.toHaveBeenCalled();
  });

  it('never persists a malformed or empty model response', async () => {
    for (const output of [{}, { explanation: '' }, null, 'text']) {
      const prisma = buildPrisma();
      const client = buildClient(jest.fn(() => Promise.resolve(output)));

      await expect(
        serviceFor(prisma, client).explain('act_1'),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(prisma.actionItem.update).not.toHaveBeenCalled();
    }
  });

  it('propagates an upstream failure without persisting anything', async () => {
    const prisma = buildPrisma();
    const client = buildClient(
      jest.fn(() => Promise.reject(new BadGatewayException('upstream'))),
    );

    await expect(
      serviceFor(prisma, client).explain('act_1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.actionItem.update).not.toHaveBeenCalled();
  });

  it('regenerates over a previous explanation', async () => {
    const prisma = buildPrisma();
    const service = serviceFor(
      prisma,
      buildClient(jest.fn(() => Promise.resolve({ explanation: 'Newer.' }))),
    );

    await service.explain('act_1');
    await service.explain('act_1');

    expect(prisma.actionItem.update).toHaveBeenCalledTimes(2);
  });
});
