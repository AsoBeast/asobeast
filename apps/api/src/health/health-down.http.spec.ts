import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { QUEUES } from '../jobs/jobs.types';
import { ErrorTracking } from '../observability/error-tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

const DRIVER_MESSAGE = "Can't reach database server at `postgres:5432`";

interface Options {
  redisUp: boolean;
}

async function healthApp({ redisUp }: Options): Promise<INestApplication<App>> {
  const unreachable = () =>
    jest.fn().mockRejectedValue(new Error(DRIVER_MESSAGE));
  const client = {
    ping: jest.fn(() =>
      redisUp ? Promise.resolve('PONG') : Promise.reject(new Error('down')),
    ),
    get: jest.fn().mockResolvedValue(null),
  };
  const prisma = {
    $queryRaw: unreachable(),
    app: { count: unreachable() },
    actionItem: { aggregate: unreachable(), count: unreachable() },
  };
  const queue = { getFailedCount: jest.fn().mockResolvedValue(0) };
  const pipeline = { getBackend: () => ({ client: Promise.resolve(client) }) };

  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: PrismaService, useValue: prisma },
      { provide: getQueueToken(QUEUES.PIPELINE), useValue: pipeline },
      { provide: getQueueToken(QUEUES.APP_STORE), useValue: queue },
      { provide: getQueueToken(QUEUES.GPLAY), useValue: queue },
      { provide: getQueueToken(QUEUES.ALERTS), useValue: queue },
      WorkspaceContext,
      CrossTenantAccess,
      { provide: ErrorTracking, useValue: { capture: jest.fn() } },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
}

describe('GET /health with the database unreachable', () => {
  let app: INestApplication<App>;

  afterEach(() => app.close());

  it('answers 503 with the health fields beside the error envelope', async () => {
    app = await healthApp({ redisUp: false });

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(response.body).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: expect.stringContaining('database') as string,
      retryAfterSeconds: 5,
      path: '/health',
      timestamp: expect.any(String) as string,
      status: 'error',
      db: 'down',
      redis: 'down',
      pipeline: null,
    });
  });

  it('tells a client how long to wait', async () => {
    app = await healthApp({ redisUp: false });

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(response.headers['retry-after']).toBe('5');
  });

  it('does not repeat the driver message to an anonymous caller', async () => {
    app = await healthApp({ redisUp: false });

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(JSON.stringify(response.body)).not.toContain('postgres:5432');
  });
});
