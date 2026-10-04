import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { WorkspaceSuspension } from '../src/auth/abuse/workspace-suspension.service';
import { WorkspaceSuspensionCliModule } from '../src/auth/abuse/workspace-suspension-cli.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { PipelineWorker } from '../src/jobs/pipeline.worker';
import { testDb } from './helpers/test-db';

describe('Workspace suspension command (e2e)', () => {
  let app: INestApplicationContext;
  let prisma: PrismaClient;

  const operatorWorkspace = () =>
    prisma.workspace.findUniqueOrThrow({ where: { id: DEFAULT_WORKSPACE_ID } });

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(
      WorkspaceSuspensionCliModule,
      { logger: false },
    );
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  afterAll(async () => {
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { suspendedAt: null, suspendedReason: null, abuseFlaggedAt: null },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('restores a suspended operator workspace', async () => {
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        suspendedAt: new Date(),
        suspendedReason: 'left by an older release',
        abuseFlaggedAt: new Date(),
      },
    });

    await app.get(WorkspaceSuspension).restore(DEFAULT_WORKSPACE_ID);

    await expect(operatorWorkspace()).resolves.toMatchObject({
      suspendedAt: null,
      suspendedReason: null,
      abuseFlaggedAt: null,
    });
  });

  it('boots without the queue workers or the scheduler', () => {
    expect(() => app.get(PipelineWorker, { strict: false })).toThrow();
  });
});
