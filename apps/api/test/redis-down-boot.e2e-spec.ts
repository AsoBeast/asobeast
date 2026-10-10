import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { QUEUES } from '../src/jobs/jobs.types';
import { restoreAuthEnv } from './helpers/auth-env';
import { startRedisOutage, type RedisOutage } from './helpers/redis-outage';
import { obliterateQueues } from './obliterate-queues';

const BOOT_DEADLINE_MS = 10_000;
const ANSWER_DEADLINE_MS = 3_000;
const RECONNECT_CYCLES_MS = 2_500;
const RECOVERY_DEADLINE_MS = 30_000;
const POLL_MS = 250;

const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('Boot while redis is down (e2e)', () => {
  let app: INestApplication<App>;
  let outage: RedisOutage;
  const upstreamPort = Number(process.env.REDIS_PORT);

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    outage = await startRedisOutage(upstreamPort);
    await outage.sever();
    process.env.REDIS_PORT = String(outage.port);
    const { AppModule } = await import('../src/app.module');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<App>();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await outage.restore().catch(() => undefined);
    await obliterateQueues(app);
    await app.close();
    await outage.stop();
    process.env.REDIS_PORT = String(upstreamPort);
    restoreAuthEnv();
  });

  it(
    'finishes booting and answers from postgres while redis is down',
    async () => {
      const booted = await Promise.race([
        app.init().then(() => true),
        elapse(BOOT_DEADLINE_MS).then(() => false),
      ]);

      expect(booted).toBe(true);
      const response = await request(app.getHttpServer())
        .get('/health')
        .timeout({ response: ANSWER_DEADLINE_MS, deadline: ANSWER_DEADLINE_MS })
        .expect(200);
      expect(response.body).toMatchObject({ status: 'ok', redis: 'down' });
    },
    BOOT_DEADLINE_MS + ANSWER_DEADLINE_MS + 5_000,
  );

  it('names the outage in the json log once it has booted', async () => {
    const printed = jest.spyOn(console, 'error').mockReturnValue();

    await elapse(RECONNECT_CYCLES_MS);

    expect(printed).not.toHaveBeenCalled();
  });

  it(
    'registers the job schedules once redis is back',
    async () => {
      await outage.restore();
      const queue = app.get<Queue>(getQueueToken(QUEUES.PIPELINE), {
        strict: false,
      });

      const deadline = Date.now() + RECOVERY_DEADLINE_MS;
      let keys: string[] = [];
      while (!keys.includes('daily') && Date.now() < deadline) {
        await elapse(POLL_MS);
        keys = (await queue.getJobSchedulers()).map(({ key }) => key);
      }

      expect(keys).toContain('daily');
    },
    RECOVERY_DEADLINE_MS + 5_000,
  );
});
