import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaService } from '../prisma/prisma.service';
import {
  EXPORT_TABLE_KEYS,
  exportTables,
  keysetAfter,
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

function primaryKeyOf(table: string): string[] {
  const model = new RegExp(
    `^model ${table.charAt(0).toUpperCase()}${table.slice(1)} \\{([^}]*)\\}`,
    'm',
  ).exec(SCHEMA)?.[1];
  if (!model) throw new Error(`no model for ${table}`);
  const compound = /@@id\(\[([^\]]+)\]\)/.exec(model)?.[1];
  if (compound) return compound.split(',').map((column) => column.trim());
  return model
    .split('\n')
    .filter((line) => /\s@id(\s|$)/.test(line))
    .map((line) => line.trim().split(/\s+/)[0]);
}

describe('keysetAfter', () => {
  const day = new Date('2023-01-01T00:00:00.000Z');

  it('asks for every row on the first page', () => {
    expect(keysetAfter(['id'], undefined)).toEqual({});
  });

  it('continues after the last row of a one column key', () => {
    expect(keysetAfter(['id'], { id: 'b', name: 'Focus' })).toEqual({
      id: { gt: 'b' },
    });
  });

  it('continues after the last row of a compound key in key order', () => {
    expect(
      keysetAfter(['appId', 'keywordId', 'date'], {
        appId: 'a',
        keywordId: 'k',
        date: day,
        position: 3,
      }),
    ).toEqual({
      appId: { gte: 'a' },
      OR: [
        { appId: { gt: 'a' } },
        { appId: 'a', keywordId: { gt: 'k' } },
        { appId: 'a', keywordId: 'k', date: { gt: day } },
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

  it('read each page in key order after the last row', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const [table] = exportTables({
      workspace: { findMany },
    } as unknown as PrismaService);

    await table.page({ id: 'ws1' }, 10);

    expect(findMany).toHaveBeenCalledWith({
      where: { id: { gt: 'ws1' } },
      orderBy: [{ id: 'asc' }],
      take: 10,
    });
  });

  it('read the phrase of each tracked keyword with it', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const tracked = exportTables({
      trackedKeyword: { findMany },
    } as unknown as PrismaService).find(
      (table) => table.name === 'trackedKeyword',
    );

    await tracked?.page(undefined, 10);

    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ appId: 'asc' }, { keywordId: 'asc' }],
      take: 10,
      include: { keyword: true },
    });
  });
});
