import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureSecurityHeaders } from '../src/security-headers';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const REQUIRED_HEADERS: Record<string, string> = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

describe('Security headers (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const nest = moduleFixture.createNestApplication<NestExpressApplication>();
    configureSecurityHeaders(nest);
    nest.use(cookieParser());
    await nest.init();
    app = nest;
    await pauseQueues(app);
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app?.close();
  });

  it('carries them on a successful json response', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers).toMatchObject(REQUIRED_HEADERS);
  });

  it('carries them on a response the exception filter builds', async () => {
    const response = await request(app.getHttpServer())
      .get('/apps')
      .expect(401);

    expect(response.headers).toMatchObject(REQUIRED_HEADERS);
  });

  it('stops naming the framework that serves it', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('does not send a content security policy that would break the docs', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers['content-security-policy']).toBeUndefined();
  });
});
