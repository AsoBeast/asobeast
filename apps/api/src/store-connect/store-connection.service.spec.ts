import { randomBytes, generateKeyPairSync } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SecretBox } from '../common/crypto/secret-box';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import type { AscAnalyticsApi } from './asc-analytics-api';
import type { AscApiFactory } from './asc-api.factory';
import { AscAgreementError, AscRejectedKeyError } from './asc-errors';
import { AGREEMENT_MISSING } from './asc-http-errors';
import {
  GcsBucketError,
  GcsError,
  GcsRejectedError,
  type GcsApi,
} from './play/gcs-api';
import type { GcsApiFactory } from './play/gcs-api.factory';
import type { PlayPublisherApi } from './play/play-publisher-api';
import { sealCredentials } from './store-credentials';
import {
  CREDENTIAL_UNREADABLE,
  StoreConnectionService,
} from './store-connection.service';
import { AppStoreKeys, PlayKeys } from './store-keys';
import type { StoreReportQueue } from './store-report-queue';

const PEM = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();

const REQUEST = {
  store: 'APP_STORE' as const,
  issuerId: '57246542-96fe-1a63-e053-0824d011072a',
  keyId: '2X9R4HXF34',
  privateKey: PEM,
};

const RSA_PEM = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();

const PLAY_REQUEST = {
  store: 'GOOGLE_PLAY' as const,
  serviceAccountJson: JSON.stringify({
    type: 'service_account',
    client_email: 'reports@focus-123.iam.gserviceaccount.com',
    private_key_id: 'a1b2c3d4e5',
    private_key: RSA_PEM,
  }),
  bucket: 'pubsite_prod_rev_01234567890987654321',
};

const CREATED_AT = new Date('2026-10-01T10:00:00.000Z');

function harness(box: SecretBox | null = new SecretBox(randomBytes(32))) {
  const rows: Record<string, unknown>[] = [];
  const tx = {
    storeConnection: {
      deleteMany: jest.fn(({ where }: { where: { store: string } }) => {
        const kept = rows.filter((row) => row.store !== where.store);
        rows.splice(0, rows.length, ...kept);
        return Promise.resolve({ count: 1 });
      }),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        rows.push({
          id: 'conn_1',
          status: 'active',
          createdAt: CREATED_AT,
          lastSyncedAt: null,
          lastError: null,
          ...data,
        });
        return Promise.resolve(rows[0]);
      }),
    },
  };
  const prisma = {
    withTransaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
    storeConnection: {
      findMany: jest.fn(() => Promise.resolve([...rows])),
      findFirst: jest.fn(({ where }: { where: { store: string } }) =>
        Promise.resolve(rows.find((row) => row.store === where.store) ?? null),
      ),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        Object.assign(rows[0], data);
        return Promise.resolve(rows[0]);
      }),
      updateMany: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        rows.forEach((row) => Object.assign(row, data));
        return Promise.resolve({ count: rows.length });
      }),
      deleteMany: jest.fn(() => {
        rows.length = 0;
        return Promise.resolve({ count: 1 });
      }),
    },
    app: {
      findMany: jest.fn(() =>
        Promise.resolve([
          {
            id: 'app_1',
            name: 'Focus',
            store: 'APP_STORE',
            storeReportRequests: [{ state: 'requested' }],
          },
          {
            id: 'app_2',
            name: 'Habits',
            store: 'APP_STORE',
            storeReportRequests: [],
          },
          {
            id: 'app_3',
            name: 'Droid',
            store: 'GOOGLE_PLAY',
            storeReportRequests: [],
          },
        ]),
      ),
    },
    storeFunnelDay: {
      aggregate: jest.fn(({ where }: { where: { appId: string } }) =>
        Promise.resolve(
          where.appId === 'app_1'
            ? {
                _min: { date: new Date('2024-01-01T00:00:00.000Z') },
                _max: { date: new Date('2026-10-12T00:00:00.000Z') },
              }
            : { _min: { date: null }, _max: { date: null } },
        ),
      ),
    },
  };
  const api = { verify: jest.fn(() => Promise.resolve()) };
  const factory = { open: jest.fn(() => api as unknown as AscAnalyticsApi) };
  const gcs = { verify: jest.fn(() => Promise.resolve()) };
  const publisher = { reply: jest.fn() };
  const gcsFactory = {
    open: jest.fn(() => gcs as unknown as GcsApi),
    publisher: jest.fn(() => publisher as unknown as PlayPublisherApi),
  };
  const queue = {
    enqueue: jest.fn(() => Promise.resolve({ outcome: 'queued' as const })),
  };
  const workspace = { require: jest.fn(() => 'ws_1') };
  const service = new StoreConnectionService(
    prisma as unknown as PrismaService,
    workspace as unknown as WorkspaceContext,
    box,
    new AppStoreKeys(factory as unknown as AscApiFactory),
    new PlayKeys(gcsFactory as unknown as GcsApiFactory),
    queue as unknown as StoreReportQueue,
  );
  return {
    service,
    prisma,
    tx,
    api,
    factory,
    gcs,
    gcsFactory,
    publisher,
    queue,
    rows,
    box,
  };
}

describe('StoreConnectionService', () => {
  it('verifies with apple before storing', async () => {
    const { service, api, tx, queue } = harness();

    const item = await service.connect('APP_STORE', REQUEST, 'user_1');

    expect(api.verify).toHaveBeenCalledTimes(1);
    expect(api.verify.mock.invocationCallOrder[0]).toBeLessThan(
      tx.storeConnection.create.mock.invocationCallOrder[0],
    );
    expect(item).toMatchObject({
      store: 'APP_STORE',
      status: 'active',
      reportAccess: 'unknown',
      issuerId: REQUEST.issuerId,
      keyId: REQUEST.keyId,
    });
    expect(item.keyFingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(item)).not.toContain('PRIVATE KEY');
    expect(queue.enqueue).toHaveBeenCalledWith('ws_1', 'APP_STORE');
  });

  it('stores the key sealed for the workspace', async () => {
    const { service, rows } = harness();

    await service.connect('APP_STORE', REQUEST, 'user_1');

    expect(rows[0].credentialCiphertext).toMatch(/^v1\./);
    expect(rows[0].credentialCiphertext).not.toContain('PRIVATE');
    expect(rows[0]).toMatchObject({
      workspaceId: 'ws_1',
      createdByUserId: 'user_1',
    });
  });

  it('connects a key pasted on one line and stores it as a well formed key', async () => {
    const { service, rows, box } = harness();
    const oneLine = PEM.replace(/\r?\n/g, '');

    await service.connect(
      'APP_STORE',
      { ...REQUEST, privateKey: oneLine },
      'user_1',
    );

    const opened = JSON.parse(
      box!.open(
        rows[0].credentialCiphertext as string,
        'store-connection:ws_1:APP_STORE',
      ),
    ) as { privateKey: string };
    expect(opened.privateKey).toBe(PEM);
  });

  it('stores no row when apple refuses', async () => {
    const { service, api, tx } = harness();
    api.verify.mockRejectedValueOnce(
      new AscRejectedKeyError('no', 401, 'NOT_AUTHORIZED'),
    );

    await expect(
      service.connect('APP_STORE', REQUEST, 'user_1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(tx.storeConnection.create).not.toHaveBeenCalled();
  });

  it('names a missing agreement on connect and on verify', async () => {
    const { service, api } = harness();
    const agreement = new AscAgreementError(
      'agreement',
      403,
      'FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED',
    );
    api.verify.mockRejectedValueOnce(agreement);

    await expect(
      service.connect('APP_STORE', REQUEST, 'user_1'),
    ).rejects.toThrow(AGREEMENT_MISSING);

    await service.connect('APP_STORE', REQUEST, 'user_1');
    api.verify.mockRejectedValueOnce(agreement);
    const rejected = await service.verify('APP_STORE');
    expect(rejected).toMatchObject({
      status: 'rejected',
      lastError: AGREEMENT_MISSING,
    });
  });

  it('refuses a malformed key before apple is called', async () => {
    const { service, factory } = harness();

    await expect(
      service.connect(
        'APP_STORE',
        { ...REQUEST, privateKey: 'nope' },
        'user_1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(factory.open).not.toHaveBeenCalled();
  });

  it('replaces an existing connection and drops its report requests', async () => {
    const { service, tx } = harness();

    await service.connect('APP_STORE', REQUEST, 'user_1');
    await service.connect(
      'APP_STORE',
      { ...REQUEST, keyId: 'NEWKEY1234' },
      'user_1',
    );

    expect(tx.storeConnection.deleteMany).toHaveBeenCalledWith({
      where: { store: 'APP_STORE' },
    });
    expect(tx.storeConnection.create).toHaveBeenCalledTimes(2);
  });

  it('refuses a body whose store differs from the path', async () => {
    const { service, factory } = harness();

    await expect(
      service.connect('GOOGLE_PLAY', REQUEST, 'user_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(factory.open).not.toHaveBeenCalled();
  });

  it('verifies a play service account by listing the bucket', async () => {
    const { service, gcs, gcsFactory, tx, queue } = harness();

    const item = await service.connect('GOOGLE_PLAY', PLAY_REQUEST, 'user_1');

    expect(gcsFactory.open).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: PLAY_REQUEST.bucket }),
    );
    expect(gcs.verify.mock.invocationCallOrder[0]).toBeLessThan(
      tx.storeConnection.create.mock.invocationCallOrder[0],
    );
    expect(item).toMatchObject({
      store: 'GOOGLE_PLAY',
      status: 'active',
      reportAccess: 'admin',
      bucket: PLAY_REQUEST.bucket,
    });
    expect(queue.enqueue).toHaveBeenCalledWith('ws_1', 'GOOGLE_PLAY');
  });

  it('stores the email, key id and bucket in clear and the key sealed', async () => {
    const { service, rows, box } = harness();

    await service.connect('GOOGLE_PLAY', PLAY_REQUEST, 'user_1');

    expect(rows[0]).toMatchObject({
      issuerId: 'reports@focus-123.iam.gserviceaccount.com',
      keyId: 'a1b2c3d4e5',
      bucket: PLAY_REQUEST.bucket,
    });
    expect(rows[0].keyFingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(rows[0].credentialCiphertext).not.toContain('PRIVATE');
    expect(
      JSON.parse(
        box!.open(
          rows[0].credentialCiphertext as string,
          'store-connection:ws_1:GOOGLE_PLAY',
        ),
      ),
    ).toEqual({
      clientEmail: 'reports@focus-123.iam.gserviceaccount.com',
      privateKeyId: 'a1b2c3d4e5',
      privateKey: RSA_PEM,
      bucket: PLAY_REQUEST.bucket,
    });
  });

  it('maps a refused account and a missing bucket to 422', async () => {
    const { service, gcs, tx } = harness();
    gcs.verify
      .mockRejectedValueOnce(new GcsRejectedError('no', 403))
      .mockRejectedValueOnce(new GcsBucketError('no', 404));

    const refused = service.connect('GOOGLE_PLAY', PLAY_REQUEST, 'user_1');
    await expect(refused).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(refused).rejects.toThrow(
      'Google refused this service account',
    );
    const missing = service.connect('GOOGLE_PLAY', PLAY_REQUEST, 'user_1');
    await expect(missing).rejects.toThrow(PLAY_REQUEST.bucket);
    expect(tx.storeConnection.create).not.toHaveBeenCalled();
  });

  it('answers 502 when google fails while checking a service account', async () => {
    const { service, gcs } = harness();
    gcs.verify.mockRejectedValueOnce(new GcsError('busy', 503));

    await expect(
      service.connect('GOOGLE_PLAY', PLAY_REQUEST, 'user_1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('refuses a service account that is not json before google is called', async () => {
    const { service, gcsFactory } = harness();

    await expect(
      service.connect(
        'GOOGLE_PLAY',
        { ...PLAY_REQUEST, serviceAccountJson: 'nope' },
        'user_1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gcsFactory.open).not.toHaveBeenCalled();
  });

  it('opens the play publisher client of the connection', async () => {
    const { service, gcsFactory, publisher } = harness();
    await service.connect('GOOGLE_PLAY', PLAY_REQUEST, 'user_1');

    await expect(service.openPlayPublisher()).resolves.toMatchObject({
      id: 'conn_1',
      status: 'active',
      api: publisher,
    });
    expect(gcsFactory.publisher).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: PLAY_REQUEST.bucket }),
    );
  });

  it('opens no play publisher client without a play connection', async () => {
    const { service, gcsFactory } = harness();
    await service.connect('APP_STORE', REQUEST, 'user_1');

    await expect(service.openPlayPublisher()).resolves.toBeNull();
    expect(gcsFactory.publisher).not.toHaveBeenCalled();
  });

  it('marks a play connection rejected on verify when google refuses', async () => {
    const { service, gcs } = harness();
    await service.connect('GOOGLE_PLAY', PLAY_REQUEST, 'user_1');
    gcs.verify.mockRejectedValueOnce(new GcsRejectedError('no', 401));

    const rejected = await service.verify('GOOGLE_PLAY');

    expect(rejected).toMatchObject({ status: 'rejected' });
    expect(rejected.lastError).toContain('Google refused');
    await expect(service.openPlay()).resolves.toMatchObject({
      status: 'rejected',
    });
    await expect(service.openAppStore()).resolves.toBeNull();
  });

  it('reseals a credential sealed with the previous key when it opens it', async () => {
    const previous = randomBytes(32);
    const old = new SecretBox(previous);
    const { service, rows, prisma } = harness(
      new SecretBox(randomBytes(32), previous),
    );
    rows.push({
      id: 'conn_1',
      store: 'APP_STORE',
      status: 'active',
      credentialCiphertext: sealCredentials(old, 'ws_1', 'APP_STORE', {
        issuerId: REQUEST.issuerId,
        keyId: REQUEST.keyId,
        privateKey: PEM,
      }),
    });
    const before = rows[0].credentialCiphertext;

    await expect(service.openAppStore()).resolves.not.toBeNull();

    expect(prisma.storeConnection.update).toHaveBeenCalledTimes(1);
    expect(rows[0].credentialCiphertext).not.toBe(before);
  });

  it('marks a connection rejected on verify when apple refuses, and active again later', async () => {
    const { service, api, rows } = harness();
    await service.connect('APP_STORE', REQUEST, 'user_1');
    api.verify.mockRejectedValueOnce(
      new AscRejectedKeyError('revoked', 401, 'NOT_AUTHORIZED'),
    );

    const rejected = await service.verify('APP_STORE');
    expect(rejected.status).toBe('rejected');
    expect(rejected.lastError).toContain('refused this key');

    const restored = await service.verify('APP_STORE');
    expect(restored).toMatchObject({ status: 'active', lastError: null });
    expect(rows[0].verifiedAt).toBeInstanceOf(Date);
  });

  it('enqueues a sync after connect and after a successful verify', async () => {
    const { service, queue } = harness();
    await service.connect('APP_STORE', REQUEST, 'user_1');
    await service.verify('APP_STORE');

    expect(queue.enqueue).toHaveBeenCalledTimes(2);
  });

  it('answers not found for verify, sync and open without a connection', async () => {
    const { service } = harness();

    await expect(service.verify('APP_STORE')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.sync('APP_STORE')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.openAppStore()).resolves.toBeNull();
  });

  it('refuses a sync while rejected', async () => {
    const { service, rows } = harness();
    await service.connect('APP_STORE', REQUEST, 'user_1');
    rows[0].status = 'rejected';

    await expect(service.sync('APP_STORE')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('lists apps of the store with their request state and date range', async () => {
    const { service } = harness();
    await service.connect('APP_STORE', REQUEST, 'user_1');

    const state = await service.state();

    expect(state.available).toBe(true);
    expect(state.connections[0].apps).toEqual([
      {
        appId: 'app_1',
        name: 'Focus',
        state: 'requested',
        firstDate: '2024-01-01',
        lastDate: '2026-10-12',
      },
      {
        appId: 'app_2',
        name: 'Habits',
        state: null,
        firstDate: null,
        lastDate: null,
      },
    ]);
  });

  it('answers unavailable without a secret box and refuses every change', async () => {
    const { service, prisma } = harness(null);

    await expect(service.state()).resolves.toEqual({
      available: false,
      connections: [],
    });
    expect(prisma.storeConnection.findMany).not.toHaveBeenCalled();
    await expect(
      service.connect('APP_STORE', REQUEST, 'user_1'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.openAppStore()).resolves.toBeNull();
  });

  it('answers 409 and marks the connection rejected when its credential no longer opens', async () => {
    const { service, rows, prisma } = harness();
    rows.push({
      id: 'conn_1',
      store: 'APP_STORE',
      status: 'active',
      credentialCiphertext: sealCredentials(
        new SecretBox(randomBytes(32)),
        'ws_1',
        'APP_STORE',
        { issuerId: REQUEST.issuerId, keyId: REQUEST.keyId, privateKey: PEM },
      ),
    });

    await expect(service.verify('APP_STORE')).rejects.toThrow(
      CREDENTIAL_UNREADABLE,
    );
    expect(prisma.storeConnection.updateMany).toHaveBeenCalledWith({
      where: { store: 'APP_STORE' },
      data: { status: 'rejected', lastError: CREDENTIAL_UNREADABLE },
    });
    await expect(service.openAppStore()).resolves.toBeNull();
  });

  it('disconnects even while store connections are off', async () => {
    const { service, prisma } = harness(null);

    await service.disconnect('APP_STORE');

    expect(prisma.storeConnection.deleteMany).toHaveBeenCalledWith({
      where: { store: 'APP_STORE' },
    });
  });

  it('disconnects by deleting the connection', async () => {
    const { service, prisma } = harness();
    await service.connect('APP_STORE', REQUEST, 'user_1');

    await service.disconnect('APP_STORE');

    expect(prisma.storeConnection.deleteMany).toHaveBeenCalledWith({
      where: { store: 'APP_STORE' },
    });
  });
});
