import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  OPERATOR_TABLES,
  SHARED_STORE_TABLES,
  TENANT_TABLES,
} from '../src/common/tenancy/tenant-tables';
import { PrismaService } from '../src/prisma/prisma.service';
import { obliterateQueues } from './obliterate-queues';

interface TableSecurity {
  relname: string;
  relrowsecurity: boolean;
  policies: bigint;
}

describe('Row level security policies (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let security: Map<string, TableSecurity>;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const rows = await prisma.$queryRaw<TableSecurity[]>`
      SELECT c.relname,
             c.relrowsecurity,
             count(p.polname) AS policies
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_policy p ON p.polrelid = c.oid
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      GROUP BY c.relname, c.relrowsecurity
    `;
    security = new Map(rows.map((row) => [row.relname, row]));
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  it.each(TENANT_TABLES)('protects %s with a policy', (table) => {
    const row = security.get(table);
    expect(row).toBeDefined();
    expect(row?.relrowsecurity).toBe(true);
    expect(Number(row?.policies)).toBeGreaterThan(0);
  });

  it.each(SHARED_STORE_TABLES)('leaves %s shared across tenants', (table) => {
    expect(security.get(table)?.relrowsecurity).toBe(false);
  });

  it.each(OPERATOR_TABLES)('reserves %s for operators', (table) => {
    const row = security.get(table);
    expect(row).toBeDefined();
    expect(row?.relrowsecurity).toBe(true);
    expect(Number(row?.policies)).toBeGreaterThan(0);
  });

  it('classifies every table as tenant-owned, shared or operator-only', () => {
    const classified = new Set<string>([
      ...TENANT_TABLES,
      ...SHARED_STORE_TABLES,
      ...OPERATOR_TABLES,
      '_prisma_migrations',
    ]);
    const unclassified = [...security.keys()].filter(
      (table) => !classified.has(table),
    );
    expect(unclassified).toEqual([]);
  });
});
