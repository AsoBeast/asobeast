import './helpers/enable-auth';
import './helpers/enable-public-url';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureCors } from '../src/cors';
import { TEST_WEB_PUBLIC_URL } from './helpers/enable-public-url';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const FOREIGN_ORIGIN = 'https://evil.example.com';

describe('CORS (e2e)', () => {
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
    app = moduleFixture.createNestApplication<App>();
    configureCors(app);
    await app.init();
    await pauseQueues(app);
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app?.close();
    delete process.env.WEB_PUBLIC_URL;
  });

  it('refuses to let an origin it does not serve read a response', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', FOREIGN_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('refuses an unserved origin on an error envelope too', async () => {
    const response = await request(app.getHttpServer())
      .get('/apps')
      .set('Origin', FOREIGN_ORIGIN)
      .expect(401);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers the origin the deployment serves', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', TEST_WEB_PUBLIC_URL)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(
      TEST_WEB_PUBLIC_URL,
    );
  });

  it('answers a preflight from the origin the deployment serves', async () => {
    const response = await request(app.getHttpServer())
      .options('/apps')
      .set('Origin', TEST_WEB_PUBLIC_URL)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');

    expect(response.headers['access-control-allow-origin']).toBe(
      TEST_WEB_PUBLIC_URL,
    );
  });

  it('never answers the opaque null origin a sandboxed page sends', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'null')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never answers a wildcard', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', FOREIGN_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });
});
