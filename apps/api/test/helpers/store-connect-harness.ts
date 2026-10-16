import { execSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { join } from 'node:path';
import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { QUEUES } from '../../src/jobs/jobs.types';
import { AscUnreachableError } from '../../src/store-connect/asc-errors';
import {
  ASC_TRANSPORT,
  type AscRequest,
  type AscResponse,
  type AscTransport,
} from '../../src/store-connect/asc-transport';
import {
  GCS_TRANSPORT,
  GcsUnreachableError,
  type GcsRequest,
  type GcsResponse,
  type GcsTransport,
} from '../../src/store-connect/play/gcs-transport';
import { useCookies } from './session';
import { testDb } from './test-db';
import { settleBootRegistration } from '../obliterate-queues';

export const TEST_PRIVATE_KEY = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
})
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();

export const CONNECTION_REQUEST = {
  store: 'APP_STORE',
  issuerId: '57246542-96fe-1a63-e053-0824d011072a',
  keyId: '2X9R4HXF34',
  privateKey: TEST_PRIVATE_KEY,
} as const;

export const TEST_RSA_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();

export const PLAY_SERVICE_ACCOUNT = {
  type: 'service_account',
  client_email: 'reports@focus-123.iam.gserviceaccount.com',
  private_key_id: 'a1b2c3d4e5f6',
  private_key: TEST_RSA_KEY,
};

export const PLAY_CONNECTION_REQUEST = {
  store: 'GOOGLE_PLAY',
  serviceAccountJson: JSON.stringify(PLAY_SERVICE_ACCOUNT),
  bucket: 'pubsite_prod_rev_01234567890987654321',
} as const;

type Answer = AscResponse | ((request: AscRequest) => AscResponse);

export const answer = (body: unknown, status = 200): AscResponse => ({
  status,
  body,
  retryAfter: null,
});

export const refusal = (status: number, code: string): AscResponse =>
  answer({ errors: [{ status: String(status), code, detail: code }] }, status);

export const bytes = (payload: Buffer): AscResponse => ({
  status: 200,
  body: null,
  bytes: payload,
  retryAfter: null,
});

export class ScriptedAppStoreConnect {
  readonly requests: AscRequest[] = [];
  private answers: { method: string; pattern: RegExp; answer: Answer }[] = [];
  unreachable = false;

  readonly transport: AscTransport = (request) => {
    this.requests.push(request);
    if (this.unreachable) {
      return Promise.reject(new AscUnreachableError('connection refused'));
    }
    const target = request.absoluteUrl ?? request.path;
    const match = [...this.answers]
      .reverse()
      .find(
        (each) => each.method === request.method && each.pattern.test(target),
      );
    if (!match) return Promise.resolve(answer({ data: [] }));
    return Promise.resolve(
      typeof match.answer === 'function' ? match.answer(request) : match.answer,
    );
  };

  on(method: AscRequest['method'], pattern: RegExp, reply: Answer): this {
    this.answers.push({ method, pattern, answer: reply });
    return this;
  }

  reset(): void {
    this.requests.length = 0;
    this.answers = [];
    this.unreachable = false;
  }
}

type GcsAnswer = GcsResponse | ((request: GcsRequest) => GcsResponse);

export const gcsAnswer = (body: unknown, status = 200): GcsResponse => ({
  status,
  body,
});

export const gcsBytes = (payload: Buffer): GcsResponse => ({
  status: 200,
  body: null,
  bytes: payload,
});

const TOKEN = gcsAnswer({ access_token: 'ya29.test', expires_in: 3600 });

export class ScriptedGoogleCloud {
  readonly requests: GcsRequest[] = [];
  private answers: { method: string; pattern: RegExp; answer: GcsAnswer }[] =
    [];
  unreachable = false;

  readonly transport: GcsTransport = (request) => {
    this.requests.push(request);
    if (this.unreachable) {
      return Promise.reject(new GcsUnreachableError('connection refused'));
    }
    const match = [...this.answers]
      .reverse()
      .find(
        (each) =>
          each.method === request.method && each.pattern.test(request.url),
      );
    if (match) {
      return Promise.resolve(
        typeof match.answer === 'function'
          ? match.answer(request)
          : match.answer,
      );
    }
    return Promise.resolve(
      request.method === 'POST' ? TOKEN : gcsAnswer({ items: [] }),
    );
  };

  on(method: GcsRequest['method'], pattern: RegExp, reply: GcsAnswer): this {
    this.answers.push({ method, pattern, answer: reply });
    return this;
  }

  reset(): void {
    this.requests.length = 0;
    this.answers = [];
    this.unreachable = false;
  }
}

export interface StoreConnectHarness {
  app: INestApplication<App>;
  prisma: PrismaClient;
  asc: ScriptedAppStoreConnect;
  gcs: ScriptedGoogleCloud;
}

export async function pauseStoreReports(app: INestApplication): Promise<void> {
  await app.get<Queue>(getQueueToken(QUEUES.STORE_CONNECT)).pause();
}

export async function startStoreConnectApp(): Promise<StoreConnectHarness> {
  execSync('pnpm prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'ignore',
  });
  const asc = new ScriptedAppStoreConnect();
  const gcs = new ScriptedGoogleCloud();
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ASC_TRANSPORT)
    .useValue(asc.transport)
    .overrideProvider(GCS_TRANSPORT)
    .useValue(gcs.transport)
    .compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  useCookies(app);
  await app.init();
  await settleBootRegistration(app);
  await pauseStoreReports(app);
  return { app, prisma: testDb(), asc, gcs };
}
