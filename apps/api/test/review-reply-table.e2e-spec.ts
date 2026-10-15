import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient, Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

describe('the review reply table (e2e)', () => {
  const sql = migrationSql('add_review_replies');
  let prisma: PrismaClient;

  const seedReview = async () => {
    const app = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'a',
        country: 'us',
        name: 'a',
      },
    });
    const review = await prisma.review.create({
      data: { appId: app.id, reviewId: 'r1', score: 1, text: 'Crashes' },
    });
    return { app, review };
  };

  const seedReply = (appId: string, reviewId: string, workspaceId: string) =>
    prisma.reviewReply.create({
      data: { reviewId, appId, workspaceId, text: 'Sorry about that' },
    });

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

  beforeEach(() =>
    prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    ),
  );

  afterAll(() => prisma.$disconnect());

  it('deletes a reply with its review', async () => {
    const { app, review } = await seedReview();
    await seedReply(app.id, review.id, DEFAULT_WORKSPACE_ID);
    await expect(prisma.reviewReply.count()).resolves.toBe(1);

    await prisma.review.delete({ where: { id: review.id } });

    await expect(prisma.reviewReply.count()).resolves.toBe(0);
  });

  it('deletes the row with its app', async () => {
    const { app, review } = await seedReview();
    await seedReply(app.id, review.id, DEFAULT_WORKSPACE_ID);

    await prisma.app.delete({ where: { id: app.id } });

    await expect(prisma.reviewReply.count()).resolves.toBe(0);
  });

  it('refuses a row that names another workspace than its app', async () => {
    const { app, review } = await seedReview();
    await prisma.workspace.create({ data: { id: 'ws_other', name: 'Other' } });
    try {
      await expect(seedReply(app.id, review.id, 'ws_other')).rejects.toThrow(
        'ReviewReply_appId_workspaceId_fkey',
      );
    } finally {
      await prisma.workspace.delete({ where: { id: 'ws_other' } });
    }
  });

  it('refuses a reply whose review belongs to another app', async () => {
    const { review } = await seedReview();
    const other = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'b',
        country: 'us',
      },
    });

    await expect(
      seedReply(other.id, review.id, DEFAULT_WORKSPACE_ID),
    ).rejects.toThrow('ReviewReply_reviewId_appId_fkey');
  });

  it('never reads the migration history table', () => {
    expect(sql).not.toContain('_prisma_migrations');
    expect(migrationSql('tie_review_replies_to_their_review')).not.toContain(
      '_prisma_migrations',
    );
  });
});
