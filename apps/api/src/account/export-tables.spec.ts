import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaService } from '../prisma/prisma.service';
import {
  EXPORT_TABLE_KEYS,
  exportTables,
  keyRange,
  keysAfter,
  withoutSecrets,
} from './export-tables';
import { TENANT_TABLES } from '../common/tenancy/tenant-tables';

describe('withoutSecrets', () => {
  it('drops every credential shaped field', () => {
    expect(
      withoutSecrets({
        id: 'u1',
        email: 'owner@example.com',
        passwordHash: 'argon2id$...',
        verificationHash: 'abc',
        tokenHash: 'def',
        secret: 'whsec',
      }),
    ).toEqual({ id: 'u1', email: 'owner@example.com' });
  });

  it('drops the credential state of a member and keeps the rest of the row', () => {
    expect(
      withoutSecrets({
        id: 'u2',
        workspaceId: 'ws1',
        email: 'member@example.com',
        name: 'Member',
        role: 'member',
        emailVerifiedAt: '2026-10-01T00:00:00.000Z',
        verificationExpiresAt: '2026-10-08T00:00:00.000Z',
        resetHash: 'f'.repeat(64),
        resetExpiresAt: '2026-10-16T22:36:51.187Z',
        sessionVersion: 3,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-02T00:00:00.000Z',
      }),
    ).toEqual({
      id: 'u2',
      workspaceId: 'ws1',
      email: 'member@example.com',
      name: 'Member',
      role: 'member',
      emailVerifiedAt: '2026-10-01T00:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    });
  });

  it('drops the checkout claim and session of a workspace and keeps its billing facts', () => {
    expect(
      withoutSecrets({
        id: 'ws1',
        plan: 'indie',
        billingCustomerId: 'cus_1',
        subscriptionId: 'sub_1',
        checkoutClaimedAt: null,
        checkoutClaimToken: 'attempt_1',
        checkoutSessionId: 'cs_test_1',
      }),
    ).toEqual({
      id: 'ws1',
      plan: 'indie',
      billingCustomerId: 'cus_1',
      subscriptionId: 'sub_1',
      checkoutClaimedAt: null,
    });
  });

  it('keeps a row that carries no secret', () => {
    expect(withoutSecrets({ id: 'app1', name: 'Focus' })).toEqual({
      id: 'app1',
      name: 'Focus',
    });
  });

  it('passes a non object through', () => {
    expect(withoutSecrets(null)).toBeNull();
    expect(withoutSecrets(7)).toBe(7);
  });
});

describe('exportTables', () => {
  const names = exportTables({} as PrismaService).map((table) => table.name);

  it('names each table once', () => {
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers every tenant owned table a workspace can read back', () => {
    const covered = names.map(
      (name) => name.charAt(0).toUpperCase() + name.slice(1),
    );
    expect(TENANT_TABLES.filter((table) => !covered.includes(table))).toEqual(
      [],
    );
  });

  it('exports the workspace row itself', () => {
    expect(names[0]).toBe('workspace');
  });
});

const SCHEMA = readFileSync(
  join(__dirname, '../../prisma/schema.prisma'),
  'utf8',
);

function modelOf(table: string): string {
  const model = new RegExp(
    `^model ${table.charAt(0).toUpperCase()}${table.slice(1)} \\{([^}]*)\\}`,
    'm',
  ).exec(SCHEMA)?.[1];
  if (!model) throw new Error(`no model for ${table}`);
  return model;
}

function primaryKeyOf(table: string): string[] {
  const model = modelOf(table);
  const compound = /@@id\(\[([^\]]+)\]\)/.exec(model)?.[1];
  if (compound) return compound.split(',').map((column) => column.trim());
  return model
    .split('\n')
    .filter((line) => /\s@id(\s|$)/.test(line))
    .map((line) => line.trim().split(/\s+/)[0]);
}

describe('keysAfter', () => {
  const day = new Date('2023-01-01T00:00:00.000Z');

  it('reads the keys of the first page in key order', () => {
    const query = keysAfter(
      'keywordRanking',
      ['appId', 'keywordId', 'date'],
      undefined,
      10,
    );

    expect(query.sql).toBe(
      'SELECT "appId","keywordId","date" FROM "KeywordRanking"  ORDER BY "appId","keywordId","date" LIMIT ?',
    );
    expect(query.values).toEqual([10]);
  });

  it('continues after the last key with one row value comparison', () => {
    const query = keysAfter(
      'keywordRanking',
      ['appId', 'keywordId', 'date'],
      { appId: 'a', keywordId: 'k', date: day, position: 3 },
      10,
    );

    expect(query.sql).toBe(
      'SELECT "appId","keywordId","date" FROM "KeywordRanking" WHERE ("appId","keywordId","date") > (?,?,?) ORDER BY "appId","keywordId","date" LIMIT ?',
    );
    expect(query.values).toEqual(['a', 'k', day, 10]);
  });

  it('continues after the last key of a one column key', () => {
    const query = keysAfter('review', ['id'], { id: 'r9' }, 10);

    expect(query.sql).toBe(
      'SELECT "id" FROM "Review" WHERE ("id") > (?) ORDER BY "id" LIMIT ?',
    );
    expect(query.values).toEqual(['r9', 10]);
  });
});

describe('keyRange', () => {
  const day = (date: number) => new Date(Date.UTC(2023, 0, date));
  const RANKING = ['appId', 'keywordId', 'date'];

  it('reads one row when the page holds one key', () => {
    const only = { appId: 'a', keywordId: 'k', date: day(1) };

    expect(keyRange(RANKING, only, { ...only, date: day(1) })).toEqual(only);
  });

  it('reads between two keys of a one column key', () => {
    expect(keyRange(['id'], { id: 'b' }, { id: 'f' })).toEqual({
      OR: [{ id: { gte: 'b', lte: 'f' } }],
    });
  });

  it('reads between two keys that differ only in the last column', () => {
    expect(
      keyRange(
        RANKING,
        { appId: 'a', keywordId: 'k', date: day(1) },
        { appId: 'a', keywordId: 'k', date: day(9) },
      ),
    ).toEqual({
      OR: [{ appId: 'a', keywordId: 'k', date: { gte: day(1), lte: day(9) } }],
    });
  });

  it('reads the tail of the first prefix, the prefixes between and the head of the last', () => {
    expect(
      keyRange(
        RANKING,
        { appId: 'a', keywordId: 'k1', date: day(5) },
        { appId: 'a', keywordId: 'k4', date: day(2) },
      ),
    ).toEqual({
      OR: [
        { appId: 'a', keywordId: 'k1', date: { gte: day(5) } },
        { appId: 'a', keywordId: { gt: 'k1', lt: 'k4' } },
        { appId: 'a', keywordId: 'k4', date: { lte: day(2) } },
      ],
    });
  });

  it('splits on the leading column when the page spans apps', () => {
    expect(
      keyRange(
        RANKING,
        { appId: 'a', keywordId: 'k8', date: day(5) },
        { appId: 'c', keywordId: 'k2', date: day(3) },
      ),
    ).toEqual({
      OR: [
        { appId: 'a', keywordId: 'k8', date: { gte: day(5) } },
        { appId: 'a', keywordId: { gt: 'k8' } },
        { appId: { gt: 'a', lt: 'c' } },
        { appId: 'c', keywordId: { lt: 'k2' } },
        { appId: 'c', keywordId: 'k2', date: { lte: day(3) } },
      ],
    });
  });
});

describe('the export keys', () => {
  it.each(EXPORT_TABLE_KEYS.map((table) => [table.name, table.key]))(
    '%s pages on its primary key in schema order',
    (name, key) => {
      expect(key).toEqual(primaryKeyOf(name));
    },
  );

  it.each(EXPORT_TABLE_KEYS.map((table) => [table.name]))(
    '%s keeps the table and column names of its model',
    (name) => {
      expect(modelOf(name)).not.toMatch(/@@?map\(/);
    },
  );

  const tableOf = (name: string, findMany: jest.Mock, keys: unknown[]) =>
    exportTables({
      [name]: { findMany },
      $queryRaw: jest.fn().mockResolvedValue(keys),
    } as unknown as PrismaService).find((table) => table.name === name);

  it('reads the rows between the first and last key of the page', async () => {
    const rows = [{ id: 'r2' }, { id: 'r3' }];
    const findMany = jest.fn().mockResolvedValue(rows);

    const page = await tableOf('review', findMany, [
      { id: 'r2' },
      { id: 'r3' },
    ])?.page({ id: 'r1' }, 2);

    expect(findMany).toHaveBeenCalledWith({
      where: { OR: [{ id: { gte: 'r2', lte: 'r3' } }] },
      orderBy: [{ id: 'asc' }],
    });
    expect(page).toEqual({ rows, next: { id: 'r3' } });
  });

  it('continues after the last key when its row was deleted before it was read', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'r2' }]);

    const page = await tableOf('review', findMany, [
      { id: 'r2' },
      { id: 'r3' },
    ])?.page(undefined, 2);

    expect(page).toEqual({ rows: [{ id: 'r2' }], next: { id: 'r3' } });
  });

  it('ends the table when the page holds fewer keys than it asked for', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'r2' }]);

    const page = await tableOf('review', findMany, [{ id: 'r2' }])?.page(
      undefined,
      2,
    );

    expect(page).toEqual({ rows: [{ id: 'r2' }], next: undefined });
  });

  it('reads no rows once no key is left', async () => {
    const findMany = jest.fn();

    const page = await tableOf('review', findMany, [])?.page(undefined, 2);

    expect(page).toEqual({ rows: [] });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('reads the phrase of each tracked keyword with it', async () => {
    const findMany = jest.fn().mockResolvedValue([]);

    await tableOf('trackedKeyword', findMany, [
      { appId: 'a', keywordId: 'k' },
    ])?.page(undefined, 10);

    expect(findMany).toHaveBeenCalledWith({
      where: { appId: 'a', keywordId: 'k' },
      orderBy: [{ appId: 'asc' }, { keywordId: 'asc' }],
      include: { keyword: true },
    });
  });
});
