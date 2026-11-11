import { execSync } from 'child_process';
import { join } from 'path';
import type { ConfigService } from '@nestjs/config';
import type { IsolationMonitor } from '../src/common/tenancy/isolation-monitor.service';
import { WorkspaceContext } from '../src/common/tenancy/workspace-context';
import type { Env } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';

const POOL_SIZE = 10;
const HELD_SECONDS = 2.6;

describe('Queries waiting for a free database connection (e2e)', () => {
  jest.setTimeout(30_000);

  const prisma = new PrismaService(
    {
      get: () => process.env.DATABASE_URL,
    } as unknown as ConfigService<Env, true>,
    new WorkspaceContext(),
    { inspect: jest.fn() } as unknown as IsolationMonitor,
  );

  beforeAll(() => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
  });

  afterAll(async () => {
    await prisma.onApplicationShutdown();
  });

  it('wait out a burst that holds every connection for longer than two seconds', async () => {
    const burst = Array.from(
      { length: POOL_SIZE * 2 },
      () =>
        prisma.$queryRaw`SELECT 1 AS done FROM pg_sleep(${HELD_SECONDS}::double precision)`,
    );

    await expect(Promise.all(burst)).resolves.toHaveLength(POOL_SIZE * 2);
  });
});
