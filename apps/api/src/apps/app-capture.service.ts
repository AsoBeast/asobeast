import { ConflictException, Injectable } from '@nestjs/common';
import { App, AppSnapshot, Prisma, Store } from '@prisma/client';
import { QuotaAdmission } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { toSnapshotData } from './apps.mapper';

type Tx = Prisma.TransactionClient | PrismaService;

const IDENTITY_LOCK = 6_120_477;

export interface CaptureOptions {
  primaryAppId?: string;
  admit?: QuotaAdmission;
}

@Injectable()
export class AppCaptureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly workspace: WorkspaceContext,
    private readonly egress: ProxyEgress,
  ) {}

  async capture(
    store: Store,
    storeAppId: string,
    country: string,
    options: CaptureOptions = {},
  ): Promise<{ app: App; snapshot: AppSnapshot }> {
    const { primaryAppId, admit } = options;
    const workspaceId = this.workspace.require('an app import');
    const identity = { workspaceId, store, storeAppId, country };
    await this.assertFreeToClaim(identity, primaryAppId);

    const normalized = await this.egress.through(store, country, () =>
      this.registry.get(store).getApp(storeAppId, country),
    );

    return this.prisma.withTransaction(async (tx) => {
      const persist = async () => {
        await this.serializeIdentity(tx, identity);
        await this.assertFreeToClaim(identity, primaryAppId, tx);
        const app = await tx.app.upsert({
          where: {
            workspaceId_store_storeAppId_country: {
              workspaceId,
              store,
              storeAppId,
              country,
            },
          },
          create: {
            workspaceId,
            store,
            storeAppId,
            country,
            name: normalized.title,
            iconUrl: normalized.iconUrl,
            isCompetitor: primaryAppId !== undefined,
            primaryAppId,
          },
          update: {
            name: normalized.title,
            iconUrl: normalized.iconUrl,
          },
        });

        const snapshot = await tx.appSnapshot.create({
          data: toSnapshotData(app.id, normalized),
        });

        return { app, snapshot };
      };

      return admit ? admit(tx, persist) : persist();
    });
  }

  private serializeIdentity(
    tx: Prisma.TransactionClient,
    identity: AppIdentity,
  ): Promise<number> {
    const key = `${identity.workspaceId}~${identity.store}~${identity.storeAppId}~${identity.country}`;
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(${IDENTITY_LOCK}, hashtext(${key}))`;
  }

  private async assertFreeToClaim(
    identity: AppIdentity,
    primaryAppId: string | undefined,
    tx: Tx = this.prisma,
  ): Promise<void> {
    const existing = await tx.app.findUnique({
      where: { workspaceId_store_storeAppId_country: identity },
      select: { isCompetitor: true, primaryAppId: true },
    });
    if (!existing) return;

    const claim = collides(existing, primaryAppId);
    if (claim) {
      throw new ConflictException(
        `${identity.storeAppId} is ${claim} in ${identity.country}. Remove it there before claiming it here.`,
      );
    }
  }
}

interface AppIdentity {
  workspaceId: string;
  store: Store;
  storeAppId: string;
  country: string;
}

function collides(
  existing: { isCompetitor: boolean; primaryAppId: string | null },
  primaryAppId: string | undefined,
): string | null {
  if (primaryAppId === undefined) {
    return existing.isCompetitor ? 'already tracked as a competitor' : null;
  }
  if (!existing.isCompetitor) return 'already tracked as an app';
  if (existing.primaryAppId !== primaryAppId) {
    return 'already a competitor of another app';
  }
  return null;
}
