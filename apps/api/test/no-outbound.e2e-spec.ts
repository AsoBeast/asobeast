import './helpers/enable-auth';
import { Socket } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ErrorTracking } from '../src/observability/error-tracking.service';
import { restoreAuthEnv } from './helpers/auth-env';
import { obliterateQueues } from './obliterate-queues';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

interface Attempt {
  host: string;
}

const attempts: Attempt[] = [];

type Connect = (this: Socket, ...args: unknown[]) => Socket;

const realConnect = Reflect.get(Socket.prototype, 'connect') as Connect;

function hostOf(args: unknown[]): string {
  const [target, second] = args;
  if (typeof target === 'object' && target !== null && 'host' in target) {
    const host = (target as { host?: unknown }).host;
    return typeof host === 'string' ? host : 'localhost';
  }
  return typeof second === 'string' ? second : 'localhost';
}

function recordConnections(): void {
  const patched: Connect = function connect(this: Socket, ...args: unknown[]) {
    attempts.push({ host: hostOf(args) });
    return realConnect.apply(this, args);
  };
  Reflect.set(Socket.prototype, 'connect', patched);
}

function restoreConnections(): void {
  Reflect.set(Socket.prototype, 'connect', realConnect);
}

describe('A self hosted deployment reaches nothing outside itself', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    delete process.env.ERROR_TRACKING_DSN;
    process.env.BILLING_ENABLED = 'false';
    recordConnections();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    attempts.length = 0;
  });

  afterAll(async () => {
    restoreConnections();
    restoreAuthEnv();
    await obliterateQueues(app);
    await app.close();
  });

  it('keeps error tracking inert with no cloud configuration', () => {
    expect(app.get(ErrorTracking).enabled).toBe(false);
  });

  it('opens no connection beyond the database and the queue', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/apps').expect(401);
    await request(app.getHttpServer())
      .get('/apps/does-not-exist/keywords')
      .expect(401);

    const remote = attempts.filter(
      (attempt) => !LOCAL_HOSTS.includes(attempt.host),
    );
    expect(remote).toEqual([]);
  });
});
