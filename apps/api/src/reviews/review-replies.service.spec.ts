import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import { ReviewRepliesService } from './review-replies.service';

const NOW = new Date('2026-10-15T12:00:00.000Z');

const buildService = (
  options: {
    store?: Store;
    app?: boolean;
    review?: boolean;
    existingText?: string;
    guidelines?: string | null;
    deleted?: number;
  } = {},
) => {
  const upsert = jest
    .fn<Promise<unknown>, [Record<string, Record<string, unknown>>]>()
    .mockImplementation((args) =>
      Promise.resolve({
        reviewId: 'rev-1',
        appId: 'app-1',
        workspaceId: 'ws_1',
        text: 'Thanks!',
        tone: null,
        model: null,
        generatedAt: null,
        repliedAt: (args.create.repliedAt as Date | null) ?? null,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  const deleteMany = jest
    .fn()
    .mockResolvedValue({ count: options.deleted ?? 0 });
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue(
        options.app === false
          ? null
          : {
              store: options.store ?? Store.APP_STORE,
              replyGuidelines: options.guidelines ?? null,
            },
      ),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.app === false ? 0 : 1 }),
    },
    review: {
      findFirst: jest.fn().mockResolvedValue(
        options.review === false
          ? null
          : {
              id: 'rev-1',
              reply:
                options.existingText === undefined
                  ? null
                  : { text: options.existingText },
            },
      ),
    },
    reviewReply: { upsert, deleteMany },
  };
  const workspace = {
    require: () => 'ws_1',
  } as unknown as WorkspaceContext;
  const service = new ReviewRepliesService(
    prisma as unknown as PrismaService,
    workspace,
  );
  return { service, upsert, deleteMany, prisma };
};

describe('ReviewRepliesService.patch', () => {
  it('creates a reply from its text', async () => {
    const { service, upsert } = buildService();

    await service.patch('app-1', 'rev-1', { text: 'Thanks!' });

    expect(upsert).toHaveBeenCalledWith({
      where: { reviewId: 'rev-1' },
      create: {
        reviewId: 'rev-1',
        appId: 'app-1',
        workspaceId: 'ws_1',
        text: 'Thanks!',
        repliedAt: null,
      },
      update: { text: 'Thanks!', repliedAt: undefined },
    });
  });

  it('marks a reply as replied and keeps its text', async () => {
    const { service, upsert } = buildService({ existingText: 'Thanks!' });

    const reply = await service.patch('app-1', 'rev-1', { replied: true });

    const [args] = upsert.mock.calls[0];
    expect(args.create.repliedAt).toBeInstanceOf(Date);
    expect(args.create.text).toBe('');
    expect(args.update.repliedAt).toBeInstanceOf(Date);
    expect(args.update.text).toBeUndefined();
    expect(reply.repliedAt).not.toBeNull();
  });

  it('undoes a mark', async () => {
    const { service, upsert } = buildService({ existingText: 'Thanks!' });

    await service.patch('app-1', 'rev-1', { replied: false });

    expect(upsert.mock.calls[0][0].update.repliedAt).toBeNull();
  });

  it('removes the row when a mark is undone and no text is left', async () => {
    const { service, upsert, deleteMany } = buildService({
      existingText: '',
      deleted: 1,
    });

    const reply = await service.patch('app-1', 'rev-1', { replied: false });

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { reviewId: 'rev-1', appId: 'app-1', text: '' },
    });
    expect(reply).toMatchObject({ text: '', repliedAt: null });
  });

  it('keeps text saved while a mark without text was being undone', async () => {
    const { service, upsert } = buildService({ existingText: '', deleted: 0 });

    await service.patch('app-1', 'rev-1', { replied: false });

    expect(upsert.mock.calls[0][0].update).toEqual({
      text: undefined,
      repliedAt: null,
    });
  });

  it('marks a review with no reply yet without keeping text', async () => {
    const { service, upsert, deleteMany } = buildService();

    await service.patch('app-1', 'rev-1', { replied: true });

    expect(deleteMany).not.toHaveBeenCalled();
    expect(upsert.mock.calls[0][0].create).toMatchObject({ text: '' });
    expect(upsert.mock.calls[0][0].create.repliedAt).toBeInstanceOf(Date);
  });

  it('writes nothing when a review with no reply is unmarked', async () => {
    const { service, upsert, deleteMany } = buildService();

    const reply = await service.patch('app-1', 'rev-1', { replied: false });

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(reply).toMatchObject({ text: '', repliedAt: null });
  });

  it('refuses empty text when the mark is being undone', async () => {
    const { service } = buildService({ existingText: 'Thanks!' });

    await expect(
      service.patch('app-1', 'rev-1', { text: '', replied: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses text over the store's limit", async () => {
    const play = buildService({ store: Store.GOOGLE_PLAY });
    const appStore = buildService({ store: Store.APP_STORE });

    await expect(
      play.service.patch('app-1', 'rev-1', { text: 'a'.repeat(351) }),
    ).rejects.toThrow(
      new BadRequestException('A Google Play reply is at most 350 characters'),
    );
    await expect(
      appStore.service.patch('app-1', 'rev-1', { text: 'a'.repeat(351) }),
    ).resolves.toBeDefined();
    await expect(
      appStore.service.patch('app-1', 'rev-1', { text: 'a'.repeat(2001) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('counts characters the way the store does', async () => {
    const { service } = buildService({ store: Store.GOOGLE_PLAY });

    await expect(
      service.patch('app-1', 'rev-1', {
        text: 'ą好'.repeat(175),
      }),
    ).resolves.toBeDefined();
  });

  it('refuses empty text on a reply that is not being marked', async () => {
    const { service } = buildService();

    await expect(
      service.patch('app-1', 'rev-1', { text: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a patch that changes nothing', async () => {
    const { service, prisma } = buildService();

    await expect(service.patch('app-1', 'rev-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.app.findFirst).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown app or review', async () => {
    await expect(
      buildService({ app: false }).service.patch('app-1', 'rev-1', {
        text: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      buildService({ review: false }).service.patch('app-1', 'rev-1', {
        text: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ReviewRepliesService.remove', () => {
  it('discards a reply', async () => {
    const { service, deleteMany } = buildService();

    await expect(service.remove('app-1', 'rev-1')).resolves.toBeUndefined();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { reviewId: 'rev-1', appId: 'app-1' },
    });
  });

  it('answers 404 for an unknown app', async () => {
    await expect(
      buildService({ app: false }).service.remove('app-1', 'rev-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ReviewRepliesService guidelines', () => {
  it('answers the guidelines of an app, empty when none', async () => {
    await expect(
      buildService({ guidelines: null }).service.guidelines('app-1'),
    ).resolves.toEqual({ guidelines: '' });
    await expect(
      buildService({
        guidelines: 'Sign as the Habit team.',
      }).service.guidelines('app-1'),
    ).resolves.toEqual({ guidelines: 'Sign as the Habit team.' });
  });

  it('replaces the guidelines and trims them', async () => {
    const { service, prisma } = buildService();

    const saved = await service.setGuidelines(
      'app-1',
      '  Sign as the Habit team.  ',
    );

    expect(prisma.app.updateMany).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: { replyGuidelines: 'Sign as the Habit team.' },
    });
    expect(saved).toEqual({ guidelines: 'Sign as the Habit team.' });
  });

  it('clears the guidelines with an empty text', async () => {
    const { service, prisma } = buildService();

    const saved = await service.setGuidelines('app-1', '');

    expect(prisma.app.updateMany).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: { replyGuidelines: null },
    });
    expect(saved).toEqual({ guidelines: '' });
  });

  it('answers 404 for an unknown app', async () => {
    const { service } = buildService({ app: false });

    await expect(service.guidelines('app-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.setGuidelines('app-1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
