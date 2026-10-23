import { TEST_GOOGLE_CLIENT } from './helpers/enable-google-sign-in';
import { TEST_STORE_CONNECT_KEY } from './helpers/enable-store-connect';
import * as argon2 from 'argon2';
import { Store } from '@prisma/client';
import type {
  ApiErrorEnvelope,
  PlaySignInStart,
  StoreConnectionItem,
  StoreConnectionState,
} from '@asobeast/shared';
import request from 'supertest';
import { decodeSecretKey, SecretBox } from '../src/common/crypto/secret-box';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import type { GcsRequest } from '../src/store-connect/play/gcs-transport';
import { GCS_READ_ONLY_SCOPE } from '../src/store-connect/play/service-account';
import { sealSignInState } from '../src/store-connect/play/sign-in-state';
import { seedApiToken } from './helpers/api-tokens';
import { OWNER, ownerAgent } from './helpers/session';
import {
  gcsAnswer,
  pauseStoreReports,
  PLAY_CONNECTION_REQUEST,
  startStoreConnectApp,
  type StoreConnectHarness,
} from './helpers/store-connect-harness';
import { clearRateLimitCounters, obliterateQueues } from './obliterate-queues';

const SIGN_IN = '/store-connections/GOOGLE_PLAY/sign-in';
const BUCKET = 'pubsite_prod_4855979533719537120';
const MEMBER = {
  email: 'member@play-sign-in.example.com',
  password: 'membersecret1',
};
const OTHER_WORKSPACE = 'ws_play_sign_in_other';
const STRANGER = {
  email: 'owner@play-sign-in-other.example.com',
  password: 'strangersecret1',
};
const ID_TOKEN = `e30.${Buffer.from(
  JSON.stringify({ email: 'owner@example.com', sub: '1098765' }),
).toString('base64url')}.sig`;

const grantOf = (call: GcsRequest): string | undefined => call.form?.grant_type;

describe('Google Play sign in (e2e)', () => {
  let harness: StoreConnectHarness;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;

  const start = async (): Promise<string> => {
    const response = await owner
      .post(SIGN_IN)
      .send({ bucket: BUCKET })
      .expect(200);
    return new URL((response.body as PlaySignInStart).url).searchParams.get(
      'state',
    )!;
  };

  const complete = (state: string) =>
    owner.post(`${SIGN_IN}/complete`).send({ code: '4/code', state });

  const grantWith = (body: object) =>
    harness.gcs.on('POST', /oauth2/, (call) =>
      grantOf(call) === 'authorization_code'
        ? gcsAnswer(body)
        : gcsAnswer({ access_token: 'ya29.signed-in', expires_in: 3600 }),
    );

  const granted = () =>
    grantWith({
      refresh_token: '1//refresh',
      id_token: ID_TOKEN,
      scope: `openid email ${GCS_READ_ONLY_SCOPE}`,
    });

  beforeAll(async () => {
    harness = await startStoreConnectApp();
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
    await harness.prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      update: {},
      create: { id: OTHER_WORKSPACE, name: 'Other' },
    });
    await harness.prisma.user.upsert({
      where: { email: STRANGER.email },
      update: { passwordHash: await argon2.hash(STRANGER.password) },
      create: {
        workspaceId: OTHER_WORKSPACE,
        email: STRANGER.email,
        passwordHash: await argon2.hash(STRANGER.password),
        role: 'owner',
        emailVerifiedAt: new Date(),
      },
    });
  }, 60_000);

  beforeEach(async () => {
    harness.gcs.reset();
    await harness.prisma.storeConnection.deleteMany({});
    await obliterateQueues(harness.app);
    await pauseStoreReports(harness.app);
    await clearRateLimitCounters(harness.app);
  });

  afterAll(async () => {
    await harness.prisma.storeConnection.deleteMany({});
    await harness.prisma.user.deleteMany({
      where: { email: { in: [MEMBER.email, STRANGER.email] } },
    });
    await harness.prisma.workspace.deleteMany({
      where: { id: OTHER_WORKSPACE },
    });
    await harness.app.close();
  });

  it('says sign in is on and sends the owner to Google', async () => {
    const state = (await owner.get('/store-connections').expect(200))
      .body as StoreConnectionState;
    expect(state.googleSignIn).toBe(true);

    const response = await owner
      .post(SIGN_IN)
      .send({ bucket: BUCKET })
      .expect(200);
    const url = new URL((response.body as PlaySignInStart).url);

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe(TEST_GOOGLE_CLIENT.id);
    expect(url.searchParams.get('redirect_uri')).toBe(
      `${TEST_GOOGLE_CLIENT.origin}/settings/google-play`,
    );
    expect(url.searchParams.get('scope')).toContain(GCS_READ_ONLY_SCOPE);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
    expect(JSON.stringify(response.body)).not.toContain(
      TEST_GOOGLE_CLIENT.secret,
    );
    expect(harness.gcs.requests).toEqual([]);
  });

  it('connects the account after listing the bucket with its refresh token', async () => {
    granted();

    const response = await complete(await start()).expect(200);
    const item = response.body as StoreConnectionItem;

    expect(item).toMatchObject({
      store: 'GOOGLE_PLAY',
      status: 'active',
      credential: 'googleAccount',
      issuerId: 'owner@example.com',
      bucket: BUCKET,
    });
    expect(harness.gcs.requests.map(grantOf)).toEqual([
      'authorization_code',
      'refresh_token',
      undefined,
    ]);
    expect(harness.gcs.requests[0].form?.code_verifier).toMatch(/^[\w-]{43}$/);
    expect(JSON.stringify(response.body)).not.toContain('1//refresh');
    const listing = harness.gcs.requests[2];
    expect(listing.url).toContain(`/storage/v1/b/${BUCKET}/o?`);
    expect(listing.bearer).toBe('ya29.signed-in');
    const row = await harness.prisma.storeConnection.findFirstOrThrow({
      where: { store: Store.GOOGLE_PLAY },
    });
    expect(row.credential).toBe('googleAccount');
    expect(row.credentialCiphertext).not.toContain('1//refresh');
  });

  it('refuses a state it did not seal and a code Google refuses', async () => {
    granted();
    const forged = await complete('v1.forged').expect(400);
    expect((forged.body as ApiErrorEnvelope).message).toContain('expired');
    expect(harness.gcs.requests).toEqual([]);

    harness.gcs.on(
      'POST',
      /oauth2/,
      gcsAnswer({ error: 'invalid_grant' }, 400),
    );
    const used = await complete(await start()).expect(400);
    expect((used.body as ApiErrorEnvelope).message).toContain(
      'Google did not accept this sign in',
    );

    harness.gcs.on(
      'POST',
      /oauth2/,
      gcsAnswer({ error: 'invalid_client' }, 401),
    );
    const misconfigured = await complete(await start()).expect(409);
    expect((misconfigured.body as ApiErrorEnvelope).message).toContain(
      'GOOGLE_PLAY_OAUTH_CLIENT_ID',
    );
    await expect(harness.prisma.storeConnection.count()).resolves.toBe(0);
  });

  it('answers 422 when the account may not read the bucket, was not granted storage or names a missing bucket', async () => {
    granted();
    harness.gcs.on('GET', /\/o\?/, gcsAnswer({ error: 'forbidden' }, 403));
    const refused = await complete(await start()).expect(422);
    expect((refused.body as ApiErrorEnvelope).message).toContain(
      `Your Google account owner@example.com cannot read ${BUCKET}`,
    );

    harness.gcs.reset();
    grantWith({
      refresh_token: '1//refresh',
      id_token: ID_TOKEN,
      scope: 'openid email',
    });
    const narrowed = await complete(await start()).expect(422);
    expect((narrowed.body as ApiErrorEnvelope).message).toContain(
      'View your data in Google Cloud Storage',
    );

    harness.gcs.reset();
    granted();
    harness.gcs.on('GET', /\/o\?/, gcsAnswer({ error: 'not found' }, 404));
    const missing = await complete(await start()).expect(422);
    expect((missing.body as ApiErrorEnvelope).message).toContain(
      `Google Cloud Storage has no bucket ${BUCKET}`,
    );
    await expect(harness.prisma.storeConnection.count()).resolves.toBe(0);
  });

  it('marks the connection rejected once Google revokes the sign in', async () => {
    granted();
    await complete(await start()).expect(200);
    harness.gcs.reset();
    harness.gcs.on(
      'POST',
      /oauth2/,
      gcsAnswer({ error: 'invalid_grant' }, 400),
    );

    const verified = await owner
      .post('/store-connections/GOOGLE_PLAY/verify')
      .expect(200);

    expect(verified.body).toMatchObject({ status: 'rejected' });
    expect((verified.body as StoreConnectionItem).lastError).toContain(
      'Google no longer accepts the sign in of owner@example.com',
    );
  });

  it('refuses a state that expired or that another workspace completes', async () => {
    granted();
    const { id: userId } = await harness.prisma.user.findUniqueOrThrow({
      where: { email: OWNER.email },
    });
    const expired = sealSignInState(
      new SecretBox(decodeSecretKey(TEST_STORE_CONNECT_KEY)),
      { workspaceId: DEFAULT_WORKSPACE_ID, userId },
      { bucket: BUCKET, verifier: 'v'.repeat(43), expiresAt: Date.now() - 1 },
    );
    await complete(expired).expect(400);

    const ownState = await start();
    const stranger = request.agent(harness.app.getHttpServer());
    await stranger.post('/auth/login').send(STRANGER).expect(200);
    const foreign = await stranger
      .post(`${SIGN_IN}/complete`)
      .send({ code: '4/code', state: ownState })
      .expect(400);

    expect((foreign.body as ApiErrorEnvelope).message).toContain('expired');
    expect(harness.gcs.requests).toEqual([]);
    await expect(harness.prisma.storeConnection.count()).resolves.toBe(0);
  });

  it('answers 502 when Google rate limits the code exchange', async () => {
    harness.gcs.on('POST', /oauth2/, gcsAnswer(null, 429));

    await complete(await start()).expect(502);
    await expect(harness.prisma.storeConnection.count()).resolves.toBe(0);
  });

  it('replaces a service account connection with the google account', async () => {
    await owner
      .put('/store-connections/GOOGLE_PLAY')
      .send(PLAY_CONNECTION_REQUEST)
      .expect(200);
    harness.gcs.reset();
    granted();

    await complete(await start()).expect(200);

    const rows = await harness.prisma.storeConnection.findMany({
      where: { store: Store.GOOGLE_PLAY },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      credential: 'googleAccount',
      issuerId: 'owner@example.com',
      bucket: BUCKET,
    });
  });

  it('refuses a bad bucket, a member and a write token', async () => {
    await owner.post(SIGN_IN).send({ bucket: 'my-bucket' }).expect(400);
    await owner.post(`${SIGN_IN}/complete`).send({ code: '' }).expect(400);

    const member = request.agent(harness.app.getHttpServer());
    await member.post('/auth/login').send(MEMBER).expect(200);
    await member.post(SIGN_IN).send({ bucket: BUCKET }).expect(403);
    await member
      .post(`${SIGN_IN}/complete`)
      .send({ code: '4/code', state: 'v1.x' })
      .expect(403);

    const token = await seedApiToken(harness.prisma, {
      seed: 'playsigninwriter',
      email: 'owner@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'owner',
      scope: 'write',
    });
    await request(harness.app.getHttpServer())
      .post(SIGN_IN)
      .set('Authorization', `Bearer ${token}`)
      .send({ bucket: BUCKET })
      .expect(403);
    expect(harness.gcs.requests).toEqual([]);
  });
});
