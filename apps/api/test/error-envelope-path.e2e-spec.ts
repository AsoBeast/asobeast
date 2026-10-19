import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { API_TOKEN_PREFIX, ApiErrorEnvelope } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { restoreAuthEnv } from './helpers/auth-env';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const TOKEN = `${API_TOKEN_PREFIX}${'a'.repeat(48)}`;

describe('Error envelope path (e2e)', () => {
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
    app.use(cookieParser());
    await app.init();
    await pauseQueues(app);
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
  });

  const bodyOf = (response: request.Response) =>
    response.body as ApiErrorEnvelope;

  it('does not echo a token put in the url of a refused mcp request', async () => {
    const response = await request(app.getHttpServer())
      .post(`/mcp?token=${TOKEN}`)
      .send({})
      .expect(401);

    expect(bodyOf(response).path).toBe('/mcp');
    expect(JSON.stringify(response.body)).not.toContain(TOKEN);
  });

  it('does not echo the query string of an unknown route', async () => {
    const response = await request(app.getHttpServer())
      .get(`/no-such-route?api_key=${TOKEN}`)
      .expect(404);

    expect(bodyOf(response).path).toBe('/no-such-route');
    expect(bodyOf(response).message).toBe('Cannot GET /no-such-route');
    expect(JSON.stringify(response.body)).not.toContain(TOKEN);
  });

  it('does not echo the query string of a validation failure', async () => {
    const response = await request(app.getHttpServer())
      .post(`/auth/login?token=${TOKEN}`)
      .send({})
      .expect(400);

    expect(bodyOf(response).path).toBe('/auth/login');
    expect(JSON.stringify(response.body)).not.toContain(TOKEN);
  });

  it('does not echo the link token of a refused unsubscribe', async () => {
    const response = await request(app.getHttpServer())
      .post('/email-alerts/ea_missing/unsubscribe?token=not-a-valid-link-token')
      .expect((res) => expect(res.status).toBeGreaterThanOrEqual(400));

    expect(bodyOf(response).path).toBe('/email-alerts/ea_missing/unsubscribe');
    expect(JSON.stringify(response.body)).not.toContain(
      'not-a-valid-link-token',
    );
  });

  it('reports the plain path when there is no query string', async () => {
    const response = await request(app.getHttpServer())
      .get('/apps')
      .expect(401);

    expect(bodyOf(response).path).toBe('/apps');
  });
});
