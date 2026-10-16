import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  Store,
  StoreConnectionItem,
  StoreConnectionRequest,
  StoreConnectionState,
  StoreConnectionStatus,
  StoreConnectionSyncResult,
  StoreReportAccess,
} from '@asobeast/shared';
import type { SecretBox } from '../common/crypto/secret-box';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import type { AscAnalyticsApi } from './asc-analytics-api';
import { AscApiFactory } from './asc-api.factory';
import { AscRejectedKeyError } from './asc-errors';
import { KEY_REFUSED, toHttpException } from './asc-http-errors';
import {
  keyFingerprintOf,
  normalizePrivateKey,
  type AscCredentials,
} from './asc-token';
import { SECRET_BOX } from './secret-box.provider';
import { connectionItems } from './store-connection-items';
import {
  needsReseal,
  openCredentials,
  sealCredentials,
} from './store-credentials';
import { StoreReportQueue } from './store-report-queue';

export const STORE_CONNECT_OFF =
  'Store connections are off on this instance. Set STORE_CONNECT_ENCRYPTION_KEY to turn them on.';
export const PLAY_ARRIVES_LATER =
  'Google Play connections arrive in a later release';
const NOT_CONNECTED = 'This workspace has not connected that store';
const REJECTED =
  'The store refused the connected key. Verify it or connect a new one first.';
const OPERATION = 'a store connection';

export interface OpenedConnection {
  id: string;
  status: StoreConnectionStatus;
  reportAccess: StoreReportAccess;
  lastError: string | null;
  api: AscAnalyticsApi;
}

@Injectable()
export class StoreConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    @Inject(SECRET_BOX) private readonly box: SecretBox | null,
    private readonly factory: AscApiFactory,
    private readonly queue: StoreReportQueue,
  ) {}

  async state(): Promise<StoreConnectionState> {
    if (!this.box) return { available: false, connections: [] };
    return { available: true, connections: await this.items() };
  }

  async connect(
    store: Store,
    request: StoreConnectionRequest,
    userId: string,
  ): Promise<StoreConnectionItem> {
    const box = this.requireBox();
    if (store !== request.store) {
      throw new NotFoundException(PLAY_ARRIVES_LATER);
    }
    const credentials: AscCredentials = {
      issuerId: request.issuerId,
      keyId: request.keyId,
      privateKey: normalizePrivateKey(request.privateKey),
    };
    const keyFingerprint = fingerprintOf(credentials.privateKey);
    if (!(await this.accepts(this.factory.open(credentials)))) {
      throw new UnprocessableEntityException(KEY_REFUSED);
    }
    const workspaceId = this.workspace.require(OPERATION);
    await this.prisma.withTransaction(async (tx) => {
      await tx.storeConnection.deleteMany({ where: { store: store } });
      await tx.storeConnection.create({
        data: {
          workspaceId,
          store: store,
          issuerId: credentials.issuerId,
          keyId: credentials.keyId,
          keyFingerprint,
          credentialCiphertext: sealCredentials(
            box,
            workspaceId,
            store,
            credentials,
          ),
          createdByUserId: userId,
          verifiedAt: new Date(),
        },
      });
    });
    await this.queue.enqueue(workspaceId, store);
    return this.item(store);
  }

  async verify(store: Store): Promise<StoreConnectionItem> {
    const connection = await this.requireConnection(store);
    if (!(await this.accepts(connection.api))) {
      await this.markRejected(store, KEY_REFUSED);
      return this.item(store);
    }
    await this.prisma.storeConnection.update({
      where: { id: connection.id },
      data: { status: 'active', verifiedAt: new Date(), lastError: null },
    });
    await this.queue.enqueue(this.workspace.require(OPERATION), store);
    return this.item(store);
  }

  async sync(store: Store): Promise<StoreConnectionSyncResult> {
    const connection = await this.requireConnection(store);
    if (connection.status === 'rejected') throw new ConflictException(REJECTED);
    return this.queue.enqueue(this.workspace.require(OPERATION), store);
  }

  async disconnect(store: Store): Promise<void> {
    this.requireBox();
    await this.prisma.storeConnection.deleteMany({ where: { store } });
  }

  async open(store: Store): Promise<OpenedConnection | null> {
    if (!this.box) return null;
    const row = await this.prisma.storeConnection.findFirst({
      where: { store },
    });
    if (!row) return null;
    const workspaceId = this.workspace.require(OPERATION);
    const credentials = openCredentials(
      this.box,
      workspaceId,
      store,
      row.credentialCiphertext,
    );
    if (needsReseal(this.box, row.credentialCiphertext)) {
      await this.prisma.storeConnection.update({
        where: { id: row.id },
        data: {
          credentialCiphertext: sealCredentials(
            this.box,
            workspaceId,
            store,
            credentials,
          ),
        },
      });
    }
    return {
      id: row.id,
      status: row.status as StoreConnectionStatus,
      reportAccess: row.reportAccess as StoreReportAccess,
      lastError: row.lastError,
      api: this.factory.open(credentials),
    };
  }

  async markRejected(store: Store, reason: string): Promise<void> {
    await this.prisma.storeConnection.updateMany({
      where: { store },
      data: { status: 'rejected', lastError: reason },
    });
  }

  async markSynced(
    store: Store,
    reportAccess: StoreReportAccess,
    lastError: string | null,
  ): Promise<void> {
    await this.prisma.storeConnection.updateMany({
      where: { store },
      data: { reportAccess, lastError, lastSyncedAt: new Date() },
    });
  }

  private async item(store: Store): Promise<StoreConnectionItem> {
    const item = (await this.items()).find((each) => each.store === store);
    if (!item) throw new NotFoundException(NOT_CONNECTED);
    return item;
  }

  private async items(): Promise<StoreConnectionItem[]> {
    const [rows, apps, ranges] = await Promise.all([
      this.prisma.storeConnection.findMany({ orderBy: { store: 'asc' } }),
      this.prisma.app.findMany({
        where: { isCompetitor: false },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          store: true,
          storeReportRequests: {
            where: { accessType: 'ONGOING' },
            select: { state: true },
          },
        },
      }),
      this.prisma.storeFunnelDay.groupBy({
        by: ['appId'],
        _min: { date: true },
        _max: { date: true },
      }),
    ]);
    return connectionItems(rows, apps, ranges);
  }

  private async requireConnection(store: Store): Promise<OpenedConnection> {
    this.requireBox();
    const connection = await this.open(store);
    if (!connection) throw new NotFoundException(NOT_CONNECTED);
    return connection;
  }

  private requireBox(): SecretBox {
    if (!this.box) throw new ConflictException(STORE_CONNECT_OFF);
    return this.box;
  }

  private async accepts(api: AscAnalyticsApi): Promise<boolean> {
    try {
      await api.verify();
      return true;
    } catch (error) {
      if (error instanceof AscRejectedKeyError) return false;
      throw toHttpException(error);
    }
  }
}

function fingerprintOf(privateKey: string): string {
  try {
    return keyFingerprintOf(privateKey);
  } catch (error) {
    throw toHttpException(error);
  }
}
