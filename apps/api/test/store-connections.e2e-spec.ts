import './helpers/enable-store-connect';
import * as argon2 from 'argon2';
import { Store } from '@prisma/client';
import type {
  ApiErrorEnvelope,
  StoreConnectionItem,
  StoreConnectionState,
} from '@asobeast/shared';
import request from 'supertest';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { seedApiToken } from './helpers/api-tokens';
import { ownerAgent } from './helpers/session';
import {
  CONNECTION_REQUEST,
  pauseStoreReports,
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

  it('answers 404 for google play and 400 for an unknown store', async () => {
    const play = await owner
      .put('/store-connections/GOOGLE_PLAY')
      .send(CONNECTION_REQUEST)
      .expect(404);
    expect((play.body as ApiErrorEnvelope).message).toContain('later release');
    await owner
      .put('/store-connections/windows')
      .send(CONNECTION_REQUEST)
      .expect(400);
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
});
