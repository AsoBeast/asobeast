import './helpers/enable-store-connect';
import * as argon2 from 'argon2';
import { Store } from '@prisma/client';
import type {
  ApiErrorEnvelope,
  AppLocalizationsResult,
  StoreConnectionItem,
  StoreConnectionState,
} from '@asobeast/shared';
import { STORE_FIELD_MANAGED } from '../src/keywords/keyword-field-managed';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import request from 'supertest';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { seedApiToken } from './helpers/api-tokens';
import { ownerAgent } from './helpers/session';
import {
  CONNECTION_REQUEST,
  gcsAnswer,
  pauseStoreReports,
  PLAY_CONNECTION_REQUEST,
  refusal,
  startStoreConnectApp,
  type StoreConnectHarness,
} from './helpers/store-connect-harness';
import { clearRateLimitCounters, obliterateQueues } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_store_connect_other';
const MEMBER = {
  email: 'member@store-connect.example.com',
  password: 'membersecret1',
};
const PATH = '/store-connections/APP_STORE';
const PLAY_PATH = '/store-connections/GOOGLE_PLAY';

describe('Store connections (e2e)', () => {
  let harness: StoreConnectHarness;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;

  const connect = (body: object = CONNECTION_REQUEST) =>
    owner.put(PATH).send(body);

  const state = async (): Promise<StoreConnectionState> =>
    (await owner.get('/store-connections').expect(200))
      .body as StoreConnectionState;

  beforeAll(async () => {
    harness = await startStoreConnectApp();
    await harness.prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      update: {},
      create: { id: OTHER_WORKSPACE, name: 'Other' },
    });
    owner = await ownerAgent(harness.app);
    await harness.prisma.user.upsert({
      where: { email: MEMBER.email },
      update: { passwordHash: await argon2.hash(MEMBER.password) },
      create: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: MEMBER.email,
        passwordHash: await argon2.hash(MEMBER.password),
        role: 'member',
        emailVerifiedAt: new Date(),
      },
    });
  }, 60_000);

  beforeEach(async () => {
    harness.asc.reset();
    harness.gcs.reset();
    await harness.prisma.storeConnection.deleteMany({});
    await harness.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(harness.app);
    await pauseStoreReports(harness.app);
    await clearRateLimitCounters(harness.app);
  });

  afterAll(async () => {
    await harness.prisma.storeConnection.deleteMany({});
    await harness.prisma.workspace.deleteMany({
      where: { id: OTHER_WORKSPACE },
    });
    await harness.prisma.user.deleteMany({ where: { email: MEMBER.email } });
    await obliterateQueues(harness.app);
    await harness.app.close();
    await harness.prisma.$disconnect();
  });

  it('answers an empty state to the owner', async () => {
    await expect(state()).resolves.toEqual({
      available: true,
      googleSignIn: false,
      connections: [],
    });
  });

  it('verifies a key with apple, stores it sealed and never returns it', async () => {
    const response = await connect().expect(200);

    const item = response.body as StoreConnectionItem;
    expect(item).toMatchObject({
      store: 'APP_STORE',
      status: 'active',
      reportAccess: 'unknown',
      issuerId: CONNECTION_REQUEST.issuerId,
      keyId: CONNECTION_REQUEST.keyId,
      lastError: null,
    });
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE KEY');
    expect(harness.asc.requests).toHaveLength(1);
    expect(harness.asc.requests[0]).toMatchObject({ method: 'GET' });
    expect(harness.asc.requests[0].path).toMatch(/^\/v1\/apps\?/);
    expect(harness.asc.requests[0].token).toMatch(/^eyJ/);
    const row = await harness.prisma.storeConnection.findFirstOrThrow();
    expect(row.workspaceId).toBe(DEFAULT_WORKSPACE_ID);
    expect(row.credentialCiphertext).toMatch(/^v1\./);
    expect(row.credentialCiphertext).not.toContain('PRIVATE');
    expect(JSON.stringify(await state())).not.toContain('PRIVATE KEY');
  });

  it('stores nothing when apple refuses the key', async () => {
    harness.asc.on('GET', /^\/v1\/apps/, refusal(401, 'NOT_AUTHORIZED'));

    const response = await connect().expect(422);

    expect((response.body as ApiErrorEnvelope).message).toContain(
      'refused this key',
    );
    await expect(harness.prisma.storeConnection.count()).resolves.toBe(0);
  });

  it('answers 502 when apple cannot be reached', async () => {
    harness.asc.unreachable = true;

    await connect().expect(502);
    await expect(harness.prisma.storeConnection.count()).resolves.toBe(0);
  });

  it('refuses a malformed key or issuer before apple is called', async () => {
    await connect({ ...CONNECTION_REQUEST, privateKey: 'not a key' }).expect(
      400,
    );
    await connect({ ...CONNECTION_REQUEST, issuerId: 'issuer' }).expect(400);
    await connect({ ...CONNECTION_REQUEST, keyId: 'short' }).expect(400);
    await connect({
      ...CONNECTION_REQUEST,
      privateKey: 'x'.repeat(4_097),
    }).expect(400);

    expect(harness.asc.requests).toHaveLength(0);
  });

  it('lets a member read the state but change nothing', async () => {
    await connect().expect(200);
    const member = request.agent(harness.app.getHttpServer());
    await member.post('/auth/login').send(MEMBER).expect(200);

    const read = await member.get('/store-connections').expect(200);
    expect((read.body as StoreConnectionState).connections).toHaveLength(1);
    await member.put(PATH).send(CONNECTION_REQUEST).expect(403);
    await member.post(`${PATH}/verify`).expect(403);
    await member.post(`${PATH}/sync`).expect(403);
    await member.delete(PATH).expect(403);
    await expect(harness.prisma.storeConnection.count()).resolves.toBe(1);
  });

  it('refuses a write token on every change and lets it read', async () => {
    const token = await seedApiToken(harness.prisma, {
      seed: 'storeconnectwriter',
      email: 'owner@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'owner',
      scope: 'write',
    });
    const bearer = (call: request.Test) =>
      call.set('Authorization', `Bearer ${token}`);
    const server = harness.app.getHttpServer();

    await bearer(request(server).get('/store-connections')).expect(200);
    await bearer(request(server).put(PATH).send(CONNECTION_REQUEST)).expect(
      403,
    );
    await bearer(request(server).post(`${PATH}/verify`)).expect(403);
    await bearer(request(server).post(`${PATH}/sync`)).expect(403);
    await bearer(request(server).delete(PATH)).expect(403);
    expect(harness.asc.requests).toHaveLength(0);
  });

  it('marks a connection rejected when a verify is refused, and clears it later', async () => {
    await connect().expect(200);
    harness.asc.on('GET', /^\/v1\/apps/, refusal(403, 'FORBIDDEN_ERROR'));

    const rejected = await owner.post(`${PATH}/verify`).expect(200);
    expect(rejected.body).toMatchObject({ status: 'rejected' });
    expect((rejected.body as StoreConnectionItem).lastError).toContain(
      'refused this key',
    );

    harness.asc.reset();
    const restored = await owner.post(`${PATH}/verify`).expect(200);
    expect(restored.body).toMatchObject({ status: 'active', lastError: null });
  });

  it('lists reply access on every connection and resets it on verify', async () => {
    const connected = await connect().expect(200);
    expect(connected.body).toMatchObject({ replyAccess: 'unknown' });

    await harness.prisma.storeConnection.updateMany({
      data: { replyAccess: 'forbidden' },
    });
    expect((await state()).connections[0]).toMatchObject({
      replyAccess: 'forbidden',
    });

    const verified = await owner.post(`${PATH}/verify`).expect(200);
    expect(verified.body).toMatchObject({ replyAccess: 'unknown' });
  });

  it('queues a sync, and refuses one while the key is rejected', async () => {
    await connect().expect(200);

    const queued = await owner.post(`${PATH}/sync`).expect(202);
    expect(queued.body).toEqual({ outcome: 'queued' });

    await harness.prisma.storeConnection.updateMany({
      data: { status: 'rejected' },
    });
    await owner.post(`${PATH}/sync`).expect(409);
  });

  it('answers 404 for verify and sync without a connection', async () => {
    await owner.post(`${PATH}/verify`).expect(404);
    await owner.post(`${PATH}/sync`).expect(404);
  });

  it('disconnects and drops the report requests but keeps the funnel rows', async () => {
    await connect().expect(200);
    const app = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '1476097583',
        country: 'us',
        name: 'Focus',
      },
    });
    const connection = await harness.prisma.storeConnection.findFirstOrThrow();
    await harness.prisma.storeReportRequest.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        connectionId: connection.id,
        appId: app.id,
        accessType: 'ONGOING',
      },
    });
    await harness.prisma.storeFunnelDay.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        appId: app.id,
        date: new Date('2026-10-01T00:00:00.000Z'),
        territory: 'United States',
        country: 'us',
        sourceType: 'search',
        pageType: 'productPage',
        processingDate: new Date('2026-10-02T00:00:00.000Z'),
      },
    });

    await owner.delete(PATH).expect(204);

    await expect(state()).resolves.toEqual({
      available: true,
      googleSignIn: false,
      connections: [],
    });
    await expect(harness.prisma.storeReportRequest.count()).resolves.toBe(0);
    await expect(harness.prisma.storeFunnelDay.count()).resolves.toBe(1);
  });

  it('lists each primary app of the store with its request state and stored dates', async () => {
    await connect().expect(200);
    const connection = await harness.prisma.storeConnection.findFirstOrThrow();
    const app = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '1476097583',
        country: 'us',
        name: 'Focus',
      },
    });
    await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: 'com.example.focus',
        country: 'us',
        name: 'Focus for Android',
      },
    });
    await harness.prisma.storeReportRequest.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        connectionId: connection.id,
        appId: app.id,
        accessType: 'ONGOING',
      },
    });
    for (const date of ['2024-01-01', '2026-10-12']) {
      await harness.prisma.storeFunnelDay.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          appId: app.id,
          date: new Date(`${date}T00:00:00.000Z`),
          territory: 'United States',
          country: 'us',
          sourceType: 'search',
          pageType: 'productPage',
          processingDate: new Date(`${date}T00:00:00.000Z`),
        },
      });
    }

    const [item] = (await state()).connections;

    expect(item.apps).toEqual([
      {
        appId: app.id,
        name: 'Focus',
        state: 'requested',
        firstDate: '2024-01-01',
        lastDate: '2026-10-12',
      },
    ]);
  });

  it('refuses a body whose store differs from the path and an unknown store', async () => {
    await owner.put(PLAY_PATH).send(CONNECTION_REQUEST).expect(400);
    await owner.put(PATH).send(PLAY_CONNECTION_REQUEST).expect(400);
    await owner
      .put(PATH)
      .send({ ...CONNECTION_REQUEST, store: 'windows' })
      .expect(400);
    await owner
      .put('/store-connections/windows')
      .send(CONNECTION_REQUEST)
      .expect(400);
    expect(harness.asc.requests).toEqual([]);
    expect(harness.gcs.requests).toEqual([]);
  });

  it('connects a play service account after listing its bucket', async () => {
    const response = await owner
      .put(PLAY_PATH)
      .send(PLAY_CONNECTION_REQUEST)
      .expect(200);
    const item = response.body as StoreConnectionItem;

    expect(item).toMatchObject({
      store: 'GOOGLE_PLAY',
      status: 'active',
      reportAccess: 'admin',
      issuerId: 'reports@focus-123.iam.gserviceaccount.com',
      keyId: 'a1b2c3d4e5f6',
      bucket: PLAY_CONNECTION_REQUEST.bucket,
    });
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE KEY');
    const listing = harness.gcs.requests.find((each) => each.method === 'GET');
    expect(listing?.url).toContain(
      `/storage/v1/b/${PLAY_CONNECTION_REQUEST.bucket}/o?prefix=stats%2Fstore_performance%2F`,
    );
    expect(listing?.bearer).toBe('ya29.test');
    const row = await harness.prisma.storeConnection.findFirstOrThrow({
      where: { store: Store.GOOGLE_PLAY },
    });
    expect(row.bucket).toBe(PLAY_CONNECTION_REQUEST.bucket);
    expect(row.credentialCiphertext).not.toContain('PRIVATE');
  });

  it('refuses a bad bucket id or service account with 400 and a refused account with 422', async () => {
    await owner
      .put(PLAY_PATH)
      .send({ ...PLAY_CONNECTION_REQUEST, bucket: 'my-bucket' })
      .expect(400);
    await owner
      .put(PLAY_PATH)
      .send({
        ...PLAY_CONNECTION_REQUEST,
        bucket: `pubsite_prod_rev_${'1'.repeat(5000)}`,
      })
      .expect(400);
    await owner
      .put(PLAY_PATH)
      .send({ ...PLAY_CONNECTION_REQUEST, serviceAccountJson: '{}' })
      .expect(400);
    await owner
      .put(PLAY_PATH)
      .send({ ...PLAY_CONNECTION_REQUEST, privateKey: 'extra' })
      .expect(400);
    expect(harness.gcs.requests).toEqual([]);

    harness.gcs.on('GET', /\/o\?/, gcsAnswer({ error: 'forbidden' }, 403));
    const refused = await owner
      .put(PLAY_PATH)
      .send(PLAY_CONNECTION_REQUEST)
      .expect(422);
    expect((refused.body as ApiErrorEnvelope).message).toContain(
      'Users and permissions',
    );
    harness.gcs.on('GET', /\/o\?/, gcsAnswer({ error: 'not found' }, 404));
    const missing = await owner
      .put(PLAY_PATH)
      .send(PLAY_CONNECTION_REQUEST)
      .expect(422);
    expect((missing.body as ApiErrorEnvelope).message).toContain(
      PLAY_CONNECTION_REQUEST.bucket,
    );
    harness.gcs.unreachable = true;
    await owner.put(PLAY_PATH).send(PLAY_CONNECTION_REQUEST).expect(502);
    await expect(
      harness.prisma.storeConnection.count({
        where: { store: Store.GOOGLE_PLAY },
      }),
    ).resolves.toBe(0);
  });

  it('answers 409 to a google sign in while the instance has no OAuth client', async () => {
    expect((await state()).googleSignIn).toBe(false);

    const refused = await owner
      .post(`${PLAY_PATH}/sign-in`)
      .send({ bucket: PLAY_CONNECTION_REQUEST.bucket })
      .expect(409);

    expect((refused.body as ApiErrorEnvelope).message).toContain(
      'GOOGLE_PLAY_OAUTH_CLIENT_ID',
    );
    expect(harness.gcs.requests).toEqual([]);
  });

  it('lists both connections with the bucket on the play one', async () => {
    await connect().expect(200);
    await owner.put(PLAY_PATH).send(PLAY_CONNECTION_REQUEST).expect(200);

    const { connections } = await state();

    const byStore = new Map(connections.map((each) => [each.store, each]));
    expect([...byStore.keys()].sort()).toEqual(['APP_STORE', 'GOOGLE_PLAY']);
    expect(byStore.get('APP_STORE')).not.toHaveProperty('bucket');
    expect(byStore.get('GOOGLE_PLAY')?.bucket).toBe(
      PLAY_CONNECTION_REQUEST.bucket,
    );
  });

  it('verifies, syncs and disconnects a play connection', async () => {
    await owner.put(PLAY_PATH).send(PLAY_CONNECTION_REQUEST).expect(200);
    harness.gcs.on('GET', /\/o\?/, gcsAnswer({ error: 'revoked' }, 401));

    const rejected = await owner.post(`${PLAY_PATH}/verify`).expect(200);
    expect((rejected.body as StoreConnectionItem).status).toBe('rejected');
    await owner.post(`${PLAY_PATH}/sync`).expect(409);

    harness.gcs.reset();
    const restored = await owner.post(`${PLAY_PATH}/verify`).expect(200);
    expect((restored.body as StoreConnectionItem).status).toBe('active');
    await owner.post(`${PLAY_PATH}/sync`).expect(202);
    await owner.delete(PLAY_PATH).expect(204);
    expect((await state()).connections).toEqual([]);
  });

  it('never shows or touches the connection of another workspace', async () => {
    await harness.prisma.storeConnection.create({
      data: {
        workspaceId: OTHER_WORKSPACE,
        store: Store.APP_STORE,
        issuerId: 'other-issuer',
        keyId: 'OTHERKEY12',
        keyFingerprint: '0000000000000000',
        credentialCiphertext: 'v1.other.sealed',
      },
    });

    await expect(state()).resolves.toEqual({
      available: true,
      googleSignIn: false,
      connections: [],
    });
    await owner.post(`${PATH}/sync`).expect(404);
    await owner.delete(PATH).expect(204);
    await expect(
      harness.prisma.storeConnection.count({
        where: { workspaceId: OTHER_WORKSPACE },
      }),
    ).resolves.toBe(1);
  });

  describe('the keyword field import', () => {
    const seedApp = async () =>
      (
        await harness.prisma.app.create({
          data: {
            workspaceId: DEFAULT_WORKSPACE_ID,
            store: Store.APP_STORE,
            storeAppId: '1476097583',
            country: 'us',
            name: 'Focus',
          },
          select: { id: true },
        })
      ).id;

    const localizationsOf = (appId: string) =>
      owner.get(`/apps/${appId}/localizations`).expect(200);

    it('answers 409 to an import without an active connection', async () => {
      const appId = await seedApp();

      const response = await owner
        .post(`/apps/${appId}/keyword-fields/import`)
        .expect(409);

      expect((response.body as ApiErrorEnvelope).message).toBe(
        'Importing the keyword fields needs an active App Store Connect connection. Connect or verify the key in Integrations first.',
      );
      await expect(harness.prisma.keywordFieldSync.count()).resolves.toBe(0);
    });

    it('marks the app following, queues the sync and hands the fields back on stop', async () => {
      await connect().expect(200);
      const appId = await seedApp();

      const started = await owner
        .post(`/apps/${appId}/keyword-fields/import`)
        .expect(200);
      const result = started.body as AppLocalizationsResult;
      expect(result.storeImport).toBe('following');
      expect(result.storeManaged).toBe(true);
      await expect(
        harness.prisma.keywordFieldSync.count({ where: { appId } }),
      ).resolves.toBe(1);
      const storeConnect = harness.app.get<Queue>(
        getQueueToken(QUEUES.STORE_CONNECT),
        { strict: false },
      );
      const queued = await storeConnect.getJobs(['wait', 'paused', 'delayed']);
      expect(queued.some((job) => job.name === JOBS.SYNC_STORE_REPORTS)).toBe(
        true,
      );

      const saved = await owner
        .put(`/apps/${appId}/keyword-field`)
        .send({ text: 'focus' })
        .expect(409);
      expect((saved.body as ApiErrorEnvelope).message).toBe(
        STORE_FIELD_MANAGED,
      );

      await owner.delete(`/apps/${appId}/keyword-fields/import`).expect(204);

      const stopped = (await localizationsOf(appId))
        .body as AppLocalizationsResult;
      expect(stopped.storeImport).toBe('available');
      expect(stopped.storeManaged).toBe(false);
      await owner
        .put(`/apps/${appId}/keyword-field`)
        .send({ text: 'focus' })
        .expect(200);
    });

    it('answers 409 to a second import and 404 to stopping without one', async () => {
      await connect().expect(200);
      const appId = await seedApp();
      await owner.post(`/apps/${appId}/keyword-fields/import`).expect(200);

      await owner.post(`/apps/${appId}/keyword-fields/import`).expect(409);
      await owner.delete(`/apps/${appId}/keyword-fields/import`).expect(204);
      await owner.delete(`/apps/${appId}/keyword-fields/import`).expect(404);
    });

    it('pauses the import while the key is rejected and keeps the fields editable', async () => {
      await connect().expect(200);
      const appId = await seedApp();
      await owner.post(`/apps/${appId}/keyword-fields/import`).expect(200);

      await harness.prisma.storeConnection.updateMany({
        data: { status: 'rejected' },
      });

      const paused = (await localizationsOf(appId))
        .body as AppLocalizationsResult;
      expect(paused.storeImport).toBe('paused');
      expect(paused.storeManaged).toBe(false);
      await owner
        .put(`/apps/${appId}/keyword-field`)
        .send({ text: 'focus' })
        .expect(200);
    });

    it('answers 400 for a competitor app', async () => {
      await connect().expect(200);
      const appId = await seedApp();
      const rival = await harness.prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: 'rival',
          country: 'us',
          name: 'Rival',
          isCompetitor: true,
          primaryAppId: appId,
        },
        select: { id: true },
      });

      const response = await owner
        .post(`/apps/${rival.id}/keyword-fields/import`)
        .expect(400);

      expect((response.body as ApiErrorEnvelope).message).toBe(
        'A competitor app has no localizations or keyword fields; use its primary app',
      );
    });
  });
});
