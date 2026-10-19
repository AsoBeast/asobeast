import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { SessionStore, endSessions } from './session-store';

const EXPIRES_AT = new Date('2026-10-24T00:00:00.000Z');
const NOW = new Date('2026-10-17T00:00:00.000Z');

const transaction = () => {
  const create = jest.fn().mockResolvedValue({});
  const deleteMany = jest.fn().mockResolvedValue({ count: 2 });
  return {
    create,
    deleteMany,
    tx: {
      session: { create, deleteMany },
    } as unknown as Prisma.TransactionClient,
  };
};

describe('SessionStore', () => {
  it('stores a fresh id with the expiry it was given and returns the id', async () => {
    const { tx, create } = transaction();
    const store = new SessionStore({} as PrismaService);

    const id = await store.open(tx, 'user_1', EXPIRES_AT);

    expect(create).toHaveBeenCalledWith({
      data: { id, userId: 'user_1', expiresAt: EXPIRES_AT },
    });
    expect(id).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('never repeats an id', async () => {
    const { tx } = transaction();
    const store = new SessionStore({} as PrismaService);

    const ids = await Promise.all(
      Array.from({ length: 50 }, () => store.open(tx, 'user_1', EXPIRES_AT)),
    );

    expect(new Set(ids).size).toBe(50);
  });

  it('finds only an unexpired session and brings its user and workspace', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const store = new SessionStore({
      session: { findFirst },
    } as unknown as PrismaService);

    await store.find('abc', NOW);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'abc', expiresAt: { gt: NOW } },
      include: { user: { include: { workspace: true } } },
    });
  });

  it('ends one session by its id', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const store = new SessionStore({
      session: { deleteMany },
    } as unknown as PrismaService);

    await store.end('abc');

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'abc' } });
  });
});

describe('endSessions', () => {
  it('ends every session of a user', async () => {
    const { tx, deleteMany } = transaction();

    await expect(endSessions(tx, 'user_1')).resolves.toEqual({ count: 2 });

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
  });
});
