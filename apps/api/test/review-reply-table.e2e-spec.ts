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

  it('keeps one reply per review', async () => {
    const { app, review } = await seedReview();
    await seedReply(app.id, review.id, DEFAULT_WORKSPACE_ID);

    await expect(
      seedReply(app.id, review.id, DEFAULT_WORKSPACE_ID),
    ).rejects.toThrow('Unique constraint');
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

  it('keeps the post columns nullable and the posting user optional', async () => {
    const { app, review } = await seedReview();
    const poster = await prisma.user.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'reply-poster@example.com',
        passwordHash: 'login-unused',
        role: 'member',
      },
    });
    try {
      await expect(
        seedReply(app.id, review.id, DEFAULT_WORKSPACE_ID),
      ).resolves.toMatchObject({
        postedAt: null,
        postedText: null,
        postState: null,
        storeReviewId: null,
        storeResponseId: null,
        postedByUserId: null,
      });
      const postedAt = new Date('2026-10-21T08:00:00.000Z');
      await prisma.reviewReply.update({
        where: { reviewId: review.id },
        data: {
          postedAt,
          postedText: 'Sorry about that',
          postState: 'pending',
          storeReviewId: '00000028-b08c-0014-729e-fbd500000000',
          storeResponseId: 'response-1',
          postedByUserId: poster.id,
        },
      });

      await prisma.user.delete({ where: { id: poster.id } });

      await expect(
        prisma.reviewReply.findUniqueOrThrow({
          where: { reviewId: review.id },
        }),
      ).resolves.toMatchObject({
        postedAt,
        postedText: 'Sorry about that',
        postState: 'pending',
        storeReviewId: '00000028-b08c-0014-729e-fbd500000000',
        storeResponseId: 'response-1',
        postedByUserId: null,
      });
    } finally {
      await prisma.user.deleteMany({ where: { id: poster.id } });
    }
  });

  it('indexes posted replies by app', async () => {
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'ReviewReply' AND schemaname = current_schema()`;

    expect(indexes.map((row) => row.indexname)).toContain(
      'ReviewReply_appId_postedAt_idx',
    );
  });

  it('starts the reply access of a store connection unknown', async () => {
    const connection = await prisma.storeConnection.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        issuerId: 'issuer',
        keyId: 'key',
        keyFingerprint: 'fingerprint',
        credentialCiphertext: 'sealed',
      },
    });
    try {
      expect(connection.replyAccess).toBe('unknown');
    } finally {
      await prisma.storeConnection.delete({ where: { id: connection.id } });
    }
  });

  it('never reads the migration history table', () => {
    expect(sql).not.toContain('_prisma_migrations');
    expect(migrationSql('tie_review_replies_to_their_review')).not.toContain(
      '_prisma_migrations',
    );
    expect(migrationSql('add_review_reply_posts')).not.toContain(
      '_prisma_migrations',
    );
  });
});
