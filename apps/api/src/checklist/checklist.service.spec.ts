import type { Prisma } from '@prisma/client';
import type { SecretBox } from '../common/crypto/secret-box';
import type { PrismaService } from '../prisma/prisma.service';
import { ChecklistService, goalOf } from './checklist.service';

const countConnections = jest.fn().mockResolvedValue(1);

const fakeTx = (checklistGoal: string | null) =>
  ({
    workspace: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ checklistGoal, checklistDismissedAt: null }),
    },
    app: { findMany: jest.fn().mockResolvedValue([]) },
    keywordField: { findMany: jest.fn().mockResolvedValue([]) },
    storeConnection: { count: countConnections },
    apiToken: { count: jest.fn().mockResolvedValue(0) },
    webhook: { count: jest.fn().mockResolvedValue(0) },
    emailAlert: { count: jest.fn().mockResolvedValue(0) },
    review: { findFirst: jest.fn().mockResolvedValue(null) },
    reviewReply: { count: jest.fn().mockResolvedValue(0) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  }) as unknown as Prisma.TransactionClient;

const serviceWith = (tx: Prisma.TransactionClient, box: SecretBox | null) =>
  new ChecklistService(
    {
      withTransaction: <T>(run: (client: Prisma.TransactionClient) => T) =>
        run(tx),
    } as unknown as PrismaService,
    box,
  );

const consoleItem = (items: { id: string }[]) =>
  items.find((item) => item.id === 'connect_console');

describe('ChecklistService', () => {
  it('leaves the console out when the instance holds no key', async () => {
    countConnections.mockClear();
    const checklist = await serviceWith(fakeTx(null), null).read();

    expect(consoleItem(checklist.items)).toBeUndefined();
    expect(countConnections).not.toHaveBeenCalled();
  });

  it('asks for the console when the instance can seal a key', async () => {
    const checklist = await serviceWith(fakeTx(null), {} as SecretBox).read();

    expect(consoleItem(checklist.items)).toMatchObject({ done: true });
  });

  it('reads a stored goal the code no longer knows as none', async () => {
    const checklist = await serviceWith(fakeTx('speed'), null).read();

    expect(checklist.goal).toBeNull();
  });

  it('keeps a known stored goal', async () => {
    const checklist = await serviceWith(fakeTx('research_idea'), null).read();

    expect(checklist.goal).toBe('research_idea');
  });
});

describe('goalOf', () => {
  it.each([
    ['improve_rankings', 'improve_rankings'],
    [null, null],
    [undefined, null],
    ['', null],
    ['IMPROVE_RANKINGS', null],
  ])('reads %p as %p', (value, goal) => {
    expect(goalOf(value)).toBe(goal);
  });
});
