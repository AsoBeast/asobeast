import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { RetentionService } from '../src/jobs/retention.service';
import { testDb } from './helpers/test-db';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';

const IN_AN_HOUR = () => new Date(Date.now() + 3_600_000);
const ERASED_WORKSPACE_ID = 'ws_session_erased';

describe('Session table (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await settleBootRegistration(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({ where: { id: ERASED_WORKSPACE_ID } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedUser = (email: string) =>
    prisma.user.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email,
        passwordHash: 'x',
        role: 'owner',
      },
    });

  it('keeps one row per session id', async () => {
    const user = await seedUser('one@example.com');
    await prisma.session.create({
      data: { id: 'session-a', userId: user.id, expiresAt: IN_AN_HOUR() },
    });

    await expect(
      prisma.session.create({
        data: { id: 'session-a', userId: user.id, expiresAt: IN_AN_HOUR() },
      }),
    ).rejects.toThrow();
  });

  it('refuses a session for a user that does not exist', async () => {
    await expect(
      prisma.session.create({
        data: { id: 'orphan', userId: 'missing', expiresAt: IN_AN_HOUR() },
      }),
    ).rejects.toThrow();
  });

  it('removes the sessions of a user when the user is deleted', async () => {
    const user = await seedUser('gone@example.com');
    const other = await seedUser('stays@example.com');
    await prisma.session.createMany({
      data: [
        { id: 'gone-1', userId: user.id, expiresAt: IN_AN_HOUR() },
        { id: 'gone-2', userId: user.id, expiresAt: IN_AN_HOUR() },
        { id: 'stays-1', userId: other.id, expiresAt: IN_AN_HOUR() },
      ],
    });

    await prisma.user.delete({ where: { id: user.id } });

    const left = await prisma.session.findMany({ select: { id: true } });
    expect(left).toEqual([{ id: 'stays-1' }]);
  });

  it('removes the sessions of a workspace that is erased', async () => {
    await prisma.workspace.create({
      data: { id: ERASED_WORKSPACE_ID, name: 'Erased' },
    });
    const user = await prisma.user.create({
      data: {
        workspaceId: ERASED_WORKSPACE_ID,
        email: 'erased@example.com',
        passwordHash: 'x',
        role: 'owner',
      },
    });
    await prisma.session.create({
      data: { id: 'erased-1', userId: user.id, expiresAt: IN_AN_HOUR() },
    });

    await prisma.workspace.delete({ where: { id: ERASED_WORKSPACE_ID } });

    await expect(prisma.session.count()).resolves.toBe(0);
  });

  it('lets the retention job remove expired sessions and keep live ones', async () => {
    const user = await seedUser('retained@example.com');
    await prisma.session.createMany({
      data: [
        {
          id: 'expired',
          userId: user.id,
          expiresAt: new Date(Date.now() - 1000),
        },
        { id: 'live', userId: user.id, expiresAt: IN_AN_HOUR() },
      ],
    });

    const deleted = await app.get(RetentionService).prune();

    expect(deleted.session).toBe(1);
    const left = await prisma.session.findMany({ select: { id: true } });
    expect(left).toEqual([{ id: 'live' }]);
  });
});
