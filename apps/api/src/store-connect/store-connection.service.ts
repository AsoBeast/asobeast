import {
  BadRequestException,
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
import { type SecretBox, SecretBoxError } from '../common/crypto/secret-box';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import type { AscAnalyticsApi } from './asc-analytics-api';
import type { GcsApi } from './play/gcs-api';
import {
  GOOGLE_OAUTH_CLIENT,
  type GoogleOAuthClient,
} from './play/google-sign-in';
import { SECRET_BOX } from './secret-box.provider';
import { connectionItems } from './store-connection-items';
import {
  type GoogleAccountCredentials,
  isAscCredentials,
  isPlayCredentials,
  needsReseal,
  openCredentials,
  sealCredentials,
  type StoreCredentials,
} from './store-credentials';
import {
  AppStoreKeys,
  type ParsedKey,
  PlayKeys,
  type StoreKeys,
} from './store-keys';
import { StoreReportQueue } from './store-report-queue';

export const STORE_CONNECT_OFF =
  'Store connections are off on this instance. Set STORE_CONNECT_ENCRYPTION_KEY to turn them on.';
export const STORE_MISMATCH =
  'The store in the body must match the store in the path';
export const CREDENTIAL_UNREADABLE =
  'The stored key can no longer be decrypted, usually because STORE_CONNECT_ENCRYPTION_KEY changed without STORE_CONNECT_ENCRYPTION_KEY_PREVIOUS. Connect the key again.';
const NOT_CONNECTED = 'This workspace has not connected that store';

class CredentialUnreadableError extends Error {}
const REJECTED =
  'The store refused the connected key. Verify it or connect a new one first.';
const OPERATION = 'a store connection';

export interface OpenedConnection<A = AscAnalyticsApi> {
  id: string;
  status: StoreConnectionStatus;
  reportAccess: StoreReportAccess;
  lastError: string | null;
  api: A;
}

interface Admitted extends ParsedKey<StoreCredentials> {
  reportAccess: StoreReportAccess;
}

interface Unsealed {
  id: string;
  status: StoreConnectionStatus;
  reportAccess: StoreReportAccess;
  lastError: string | null;
  credentials: StoreCredentials;
}

async function admitted<R, C extends StoreCredentials, A>(
  keys: StoreKeys<R, C, A>,
  parsed: ParsedKey<C>,
): Promise<Admitted> {
  const refusal = await keys.refusal(parsed.credentials);
  if (refusal) throw new UnprocessableEntityException(refusal);
  return { ...parsed, reportAccess: keys.reportAccess };
}

@Injectable()
export class StoreConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    @Inject(SECRET_BOX) private readonly box: SecretBox | null,
    private readonly appStore: AppStoreKeys,
    private readonly play: PlayKeys,
    private readonly queue: StoreReportQueue,
    @Inject(GOOGLE_OAUTH_CLIENT)
    private readonly signInClient: GoogleOAuthClient | null,
  ) {}

  async state(): Promise<StoreConnectionState> {
    if (!this.box) return { available: false, connections: [] };
    return {
      available: true,
      googleSignIn: this.signInClient !== null,
      connections: await this.items(),
    };
  }

  async connect(
    store: Store,
    request: StoreConnectionRequest,
    userId: string,
  ): Promise<StoreConnectionItem> {
    const box = this.requireBox();
    if (store !== request.store) throw new BadRequestException(STORE_MISMATCH);
    const key =
      request.store === 'APP_STORE'
        ? await admitted(this.appStore, this.appStore.parse(request))
        : await admitted(this.play, this.play.parse(request));
    return this.save(box, store, key, userId);
  }

  async connectGoogleAccount(
    credentials: GoogleAccountCredentials,
    subject: string,
    userId: string,
  ): Promise<StoreConnectionItem> {
    const box = this.requireBox();
    const key = await admitted(
      this.play,
      this.play.signedIn(credentials, subject),
    );
    return this.save(box, 'GOOGLE_PLAY', key, userId);
  }

  async verify(store: Store): Promise<StoreConnectionItem> {
    this.requireBox();
    const connection = await this.readable(store);
    if (!connection) throw new NotFoundException(NOT_CONNECTED);
    const refusal = await this.refusalOf(connection.credentials);
    if (refusal) {
      await this.markRejected(store, refusal);
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
    this.requireBox();
    const row = await this.prisma.storeConnection.findFirst({
      where: { store },
      select: { status: true },
    });
    if (!row) throw new NotFoundException(NOT_CONNECTED);
    if (row.status === 'rejected') throw new ConflictException(REJECTED);
    return this.queue.enqueue(this.workspace.require(OPERATION), store);
  }

  async disconnect(store: Store): Promise<void> {
    await this.prisma.storeConnection.deleteMany({ where: { store } });
  }

  async openAppStore(): Promise<OpenedConnection | null> {
    const connection = await this.unsealedOrNull('APP_STORE');
    if (!connection || !isAscCredentials(connection.credentials)) return null;
    return this.opened(connection, this.appStore.api(connection.credentials));
  }

  async openPlay(): Promise<OpenedConnection<GcsApi> | null> {
    const connection = await this.unsealedOrNull('GOOGLE_PLAY');
    if (!connection || !isPlayCredentials(connection.credentials)) return null;
    return this.opened(connection, this.play.api(connection.credentials));
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

  private async save(
    box: SecretBox,
    store: Store,
    key: Admitted,
    userId: string,
  ): Promise<StoreConnectionItem> {
    const workspaceId = this.workspace.require(OPERATION);
    await this.prisma.withTransaction(async (tx) => {
      await tx.storeConnection.deleteMany({ where: { store } });
      await tx.storeConnection.create({
        data: {
          workspaceId,
          store,
          issuerId: key.issuerId,
          keyId: key.keyId,
          keyFingerprint: key.keyFingerprint,
          bucket: key.bucket,
          credential: key.credential,
          reportAccess: key.reportAccess,
          credentialCiphertext: sealCredentials(
            box,
            workspaceId,
            store,
            key.credentials,
          ),
          createdByUserId: userId,
          verifiedAt: new Date(),
        },
      });
    });
    await this.queue.enqueue(workspaceId, store);
    return this.item(store);
  }

  private opened<A>(connection: Unsealed, api: A): OpenedConnection<A> {
    return {
      id: connection.id,
      status: connection.status,
      reportAccess: connection.reportAccess,
      lastError: connection.lastError,
      api,
    };
  }

  private refusalOf(credentials: StoreCredentials): Promise<string | null> {
    return isPlayCredentials(credentials)
      ? this.play.refusal(credentials)
      : this.appStore.refusal(credentials);
  }

  private async unsealedOrNull(store: Store): Promise<Unsealed | null> {
    try {
      return await this.unsealed(store);
    } catch (error) {
      if (error instanceof CredentialUnreadableError) return null;
      throw error;
    }
  }

  private async readable(store: Store): Promise<Unsealed | null> {
    try {
      return await this.unsealed(store);
    } catch (error) {
      if (!(error instanceof CredentialUnreadableError)) throw error;
      throw new ConflictException(CREDENTIAL_UNREADABLE);
    }
  }

  private async credentialsOf(
    box: SecretBox,
    workspaceId: string,
    store: Store,
    sealed: string,
  ): Promise<StoreCredentials> {
    try {
      return openCredentials(box, workspaceId, store, sealed);
    } catch (error) {
      if (!(error instanceof SecretBoxError)) throw error;
      await this.markRejected(store, CREDENTIAL_UNREADABLE);
      throw new CredentialUnreadableError();
    }
  }

  private async unsealed(store: Store): Promise<Unsealed | null> {
    if (!this.box) return null;
    const row = await this.prisma.storeConnection.findFirst({
      where: { store },
    });
    if (!row) return null;
    const workspaceId = this.workspace.require(OPERATION);
    const credentials = await this.credentialsOf(
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
      credentials,
    };
  }

  private async item(store: Store): Promise<StoreConnectionItem> {
    const item = (await this.items()).find((each) => each.store === store);
    if (!item) throw new NotFoundException(NOT_CONNECTED);
    return item;
  }

  private async items(): Promise<StoreConnectionItem[]> {
    const [rows, apps] = await Promise.all([
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
    ]);
    const reported = apps.filter((app) =>
      rows.some((row) => row.store === app.store),
    );
    const ranges = await Promise.all(
      reported.map(async (app) => ({
        appId: app.id,
        ...(await this.prisma.storeFunnelDay.aggregate({
          where: { appId: app.id },
          _min: { date: true },
          _max: { date: true },
        })),
      })),
    );
    return connectionItems(rows, apps, ranges);
  }

  private requireBox(): SecretBox {
    if (!this.box) throw new ConflictException(STORE_CONNECT_OFF);
    return this.box;
  }
}
