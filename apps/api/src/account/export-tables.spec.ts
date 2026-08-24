import type { PrismaService } from '../prisma/prisma.service';
import { exportTables, withoutSecrets } from './export-tables';
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
