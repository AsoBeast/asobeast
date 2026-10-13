import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const OLD_CHECK = {
  id: 'keyword-field-bytes',
  label: 'Byte usage',
  status: 'fail',
  score: 0,
};
const NEW_CHECK = {
  ...OLD_CHECK,
  id: 'keyword-field-length',
  label: 'Character usage',
};
const HYGIENE = {
  id: 'keyword-field-hygiene',
  label: 'Keyword field hygiene',
  status: 'pass',
  score: 10,
};

const factorsWith = (check: object) => [
  { id: 'title', score: 8, weight: 25, confidence: 1, checks: [] },
  {
    id: 'keywordField',
    score: 4,
    weight: 15,
    confidence: 1,
    checks: [check, HYGIENE],
  },
];

describe('the rename keyword field length check migration', () => {
  const sql = migrationSql('rename_keyword_field_length_check');
  let prisma: PrismaClient;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const seedApp = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '1',
        country: 'pl',
        name: 'Geo Guesser',
      },
    });

  const runMigration = async () => {
    for (const statement of sql.split(';')) {
      if (statement.trim()) await prisma.$executeRawUnsafe(statement);
    }
  };

  const action = (appId: string, rule: string, evidence: object) =>
    prisma.actionItem.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        appId,
        rule,
        category: 'audit',
        store: Store.APP_STORE,
        country: 'pl',
        fingerprint: `${rule}-${appId}`,
        priority: 'high',
        impact: 50,
        formulaVersion: 'v1',
        evidence,
        lastSeenAt: new Date('2026-10-13T06:00:00.000Z'),
      },
    });

  it('renames the check in every stored audit score and keeps the rest', async () => {
    const app = await seedApp();
    await prisma.auditScore.create({
      data: {
        appId: app.id,
        date: new Date('2026-10-12'),
        overall: 61,
        coveredWeight: 40,
        totalWeight: 40,
        factors: factorsWith(OLD_CHECK),
      },
    });

    await runMigration();

    const [score] = await prisma.auditScore.findMany({
      where: { appId: app.id },
    });
    expect(score.factors).toEqual(factorsWith(NEW_CHECK));
    expect(score.overall).toBe(61);
  });

  it('leaves a v1 score that has no check list untouched', async () => {
    const app = await seedApp();
    await prisma.auditScore.create({
      data: {
        appId: app.id,
        date: new Date('2026-07-15'),
        overall: 78.5,
        coveredWeight: 32,
        totalWeight: 40,
        factors: { title: 8 },
      },
    });

    await runMigration();

    const [score] = await prisma.auditScore.findMany({
      where: { appId: app.id },
    });
    expect(score.factors).toEqual({ title: 8 });
  });

  it('renames the check in the failing checks of an audit action only', async () => {
    const app = await seedApp();
    const evidence = (check: object) => ({
      rule: 'audit.fix_factor',
      factorId: 'keywordField',
      factorLabel: 'Keyword field',
      failingChecks: [check, HYGIENE],
    });
    const audit = await action(app.id, 'audit.fix_factor', evidence(OLD_CHECK));
    const other = await action(app.id, 'keyword.add_uncovered', {
      rule: 'keyword.add_uncovered',
      note: 'keyword-field-bytes',
    });

    await runMigration();

    const rows = await prisma.actionItem.findMany({
      where: { id: { in: [audit.id, other.id] } },
      select: { id: true, evidence: true },
    });
    const byId = Object.fromEntries(rows.map((row) => [row.id, row.evidence]));
    expect(byId[audit.id]).toEqual(evidence(NEW_CHECK));
    expect(byId[other.id]).toEqual({
      rule: 'keyword.add_uncovered',
      note: 'keyword-field-bytes',
    });
  });

  it('is a no op when it runs again', async () => {
    const app = await seedApp();
    await prisma.auditScore.create({
      data: {
        appId: app.id,
        date: new Date('2026-10-12'),
        overall: 61,
        coveredWeight: 40,
        totalWeight: 40,
        factors: factorsWith(OLD_CHECK),
      },
    });

    await runMigration();
    await runMigration();

    const [score] = await prisma.auditScore.findMany({
      where: { appId: app.id },
    });
    expect(score.factors).toEqual(factorsWith(NEW_CHECK));
  });
});
