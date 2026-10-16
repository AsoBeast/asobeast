import { randomBytes, generateKeyPairSync } from 'node:crypto';
import {
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
import { AscRejectedKeyError } from './asc-errors';
import { sealCredentials } from './store-credentials';
import { StoreConnectionService } from './store-connection.service';
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

const CREATED_AT = new Date('2026-10-01T10:00:00.000Z');

function harness(box: SecretBox | null = new SecretBox(randomBytes(32))) {
  const rows: Record<string, unknown>[] = [];
  const connectionRow = () => rows[0] ?? null;
  const tx = {
    storeConnection: {
      deleteMany: jest.fn(() => {
        rows.length = 0;
        return Promise.resolve({ count: 1 });
      }),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        rows.push({
          id: 'conn_1',
          status: 'active',
          reportAccess: 'unknown',
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
      findFirst: jest.fn(() => Promise.resolve(connectionRow())),
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
      groupBy: jest.fn(() =>
        Promise.resolve([
          {
            appId: 'app_1',
            _min: { date: new Date('2024-01-01T00:00:00.000Z') },
            _max: { date: new Date('2026-10-12T00:00:00.000Z') },
          },
        ]),
      ),
    },
  };
  const api = { verify: jest.fn(() => Promise.resolve()) };
  const factory = { open: jest.fn(() => api as unknown as AscAnalyticsApi) };
  const queue = {
    enqueue: jest.fn(() => Promise.resolve({ outcome: 'queued' as const })),
  };
  const workspace = { require: jest.fn(() => 'ws_1') };
  const service = new StoreConnectionService(
    prisma as unknown as PrismaService,
    workspace as unknown as WorkspaceContext,
    box,
    factory as unknown as AscApiFactory,
    queue as unknown as StoreReportQueue,
  );
  return { service, prisma, tx, api, factory, queue, rows, box };
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

  it('refuses google play until it ships', async () => {
    const { service } = harness();

    await expect(
      service.connect('GOOGLE_PLAY', REQUEST, 'user_1'),
    ).rejects.toBeInstanceOf(NotFoundException);
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

    await expect(service.open('APP_STORE')).resolves.not.toBeNull();

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
    await expect(service.open('APP_STORE')).resolves.toBeNull();
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
    await expect(service.disconnect('APP_STORE')).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.open('APP_STORE')).resolves.toBeNull();
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
