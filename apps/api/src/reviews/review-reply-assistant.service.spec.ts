import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Store } from '@prisma/client';
import { aiCompletion } from '../ai/ai-completion.fixture';
import { buildAi } from '../ai/ai-gateway.fixture';
import type { AiGateway } from '../ai/ai-gateway.service';
import type { AiStructuredRequest } from '../ai/openai.client';
import { HOME_LISTING, NEWEST_FIRST } from '../apps/listing';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import { ReviewReplyAssistant } from './review-reply-assistant.service';
import { DRAFT_MAX_OUTPUT_TOKENS } from './review-reply-drafts';

const NOW = new Date('2026-10-15T12:00:00.000Z');

const setup = (
  options: {
    store?: Store;
    output?: unknown;
    configured?: boolean;
    review?: boolean;
  } = {},
) => {
  const spend = jest
    .fn<Promise<unknown>, [Record<string, unknown>, AiStructuredRequest]>()
    .mockResolvedValue(
      aiCompletion(
        options.output ?? { reply: 'Thanks Jordan, sorry!', language: 'en' },
      ),
    );
  const ai = buildAi(spend, options.configured ?? true);
  const upsert = jest
    .fn<Promise<unknown>, [Record<string, Record<string, unknown>>]>()
    .mockImplementation((args) =>
      Promise.resolve({
        reviewId: 'rev-1',
        appId: 'app-1',
        workspaceId: 'ws_1',
        repliedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
        ...args.update,
      }),
    );
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue({
        store: options.store ?? Store.APP_STORE,
        name: 'Tomato Clock',
        replyGuidelines: 'Sign as the Tomato team.',
      }),
    },
    review: {
      findFirst: jest.fn().mockResolvedValue(
        options.review === false
          ? null
          : {
              id: 'rev-1',
              userName: 'Jordan',
              score: 2,
              title: 'Crashes',
              text: 'It crashes on launch.',
              version: '3.4.0',
              reviewedAt: NOW,
              replyText: null,
            },
      ),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { replyText: 'Thanks, fixed in 2.1' },
          { replyText: 'Glad you like it' },
        ]),
    },
    appSnapshot: {
      findFirst: jest.fn().mockResolvedValue({
        version: '3.5.0',
        raw: { releaseNotes: 'Fixed the launch crash.' },
      }),
    },
    reviewReply: { upsert },
  };
  const workspace = { require: () => 'ws_1' } as unknown as WorkspaceContext;
  const assistant = new ReviewReplyAssistant(
    ai as unknown as AiGateway,
    prisma as unknown as PrismaService,
    workspace,
  );
  const contextOf = () => {
    const [part] = spend.mock.calls[0][1].content;
    return part.type === 'text' ? part.text : '';
  };
  return { assistant, spend, upsert, prisma, contextOf };
};

describe('ReviewReplyAssistant.draft', () => {
  it('spends one call under the review reply feature and stores the draft', async () => {
    const { assistant, spend, upsert } = setup();

    const result = await assistant.draft(
      'app-1',
      'rev-1',
      { tone: 'friendly' },
      'user-1',
    );

    expect(spend).toHaveBeenCalledTimes(1);
    expect(spend.mock.calls[0][0]).toEqual({
      feature: 'reviewReply',
      appId: 'app-1',
      userId: 'user-1',
    });
    expect(spend.mock.calls[0][1].schema.name).toBe('review_reply');
    expect(spend.mock.calls[0][1].maxOutputTokens).toBe(
      DRAFT_MAX_OUTPUT_TOKENS,
    );
    const [args] = upsert.mock.calls[0];
    for (const branch of [args.create, args.update]) {
      expect(branch).toMatchObject({
        text: 'Thanks Jordan, sorry!',
        tone: 'friendly',
        model: 'gpt-4o',
      });
      expect(branch.generatedAt).toBeInstanceOf(Date);
      expect(branch).not.toHaveProperty('repliedAt');
    }
    expect(result).toMatchObject({
      reply: { text: 'Thanks Jordan, sorry!', tone: 'friendly' },
      language: 'en',
      truncated: false,
    });
  });

  it('defaults the tone to neutral', async () => {
    const { assistant, upsert, contextOf } = setup();

    await assistant.draft('app-1', 'rev-1', {}, 'user-1');

    expect(upsert.mock.calls[0][0].update.tone).toBe('neutral');
    expect(contextOf()).toContain('Tone: neutral');
  });

  it('fits the answer to the google play limit and says so', async () => {
    const { assistant } = setup({
      store: Store.GOOGLE_PLAY,
      output: {
        reply: `${'a'.repeat(300)}. ${'b'.repeat(98)}.`,
        language: 'en',
      },
    });

    const result = await assistant.draft('app-1', 'rev-1', {}, 'user-1');

    expect(result.truncated).toBe(true);
    expect(result.reply.text).toBe(`${'a'.repeat(300)}.`);
  });

  it('reads the newest home snapshot for the version and release notes', async () => {
    const { assistant, prisma, contextOf } = setup();

    await assistant.draft('app-1', 'rev-1', {}, 'user-1');

    expect(prisma.appSnapshot.findFirst).toHaveBeenCalledWith({
      where: { appId: 'app-1', ...HOME_LISTING },
      orderBy: NEWEST_FIRST,
      select: { version: true, raw: true },
    });
    expect(contextOf()).toContain('Current version: "3.5.0"');
    expect(contextOf()).toContain('Fixed the launch crash.');
  });

  it('hands the newest google play replies to the prompt as examples', async () => {
    const { assistant, prisma, contextOf } = setup();

    await assistant.draft('app-1', 'rev-1', {}, 'user-1');

    expect(prisma.review.findMany).toHaveBeenCalledWith({
      where: {
        appId: 'app-1',
        id: { not: 'rev-1' },
        replyText: { not: null },
      },
      orderBy: { repliedAt: { sort: 'desc', nulls: 'last' } },
      take: 3,
      select: { replyText: true },
    });
    expect(contextOf()).toContain('"Thanks, fixed in 2.1"');
    expect(contextOf()).toContain(
      'Owner guidelines: "Sign as the Tomato team."',
    );
  });

  it('answers 502 when the model returns no usable reply', async () => {
    const { assistant, upsert } = setup({ output: {} });

    await expect(
      assistant.draft('app-1', 'rev-1', {}, 'user-1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('refuses a draft that adds an address the owner never gave', async () => {
    const { assistant, upsert } = setup({
      output: {
        reply: 'Sorry! Email refunds@evil.example for a refund.',
        language: 'en',
      },
    });

    await expect(
      assistant.draft('app-1', 'rev-1', {}, 'user-1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('keeps an address the instructions gave', async () => {
    const { assistant, upsert } = setup({
      output: {
        reply: 'Sorry! Write to help@tomato.app and we will help.',
        language: 'en',
      },
    });

    await assistant.draft(
      'app-1',
      'rev-1',
      { instructions: 'Point to help@tomato.app' },
      'user-1',
    );

    expect(upsert).toHaveBeenCalled();
  });

  it('answers 409 before reading anything without a key', async () => {
    const { assistant, prisma } = setup({ configured: false });

    await expect(
      assistant.draft('app-1', 'rev-1', {}, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.app.findFirst).not.toHaveBeenCalled();
  });

  it('answers 404 before spending for an unknown review', async () => {
    const { assistant, spend } = setup({ review: false });

    await expect(
      assistant.draft('app-1', 'rev-1', {}, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(spend).not.toHaveBeenCalled();
  });
});
