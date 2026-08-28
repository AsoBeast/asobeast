import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppSnapshot, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  AppDetail,
  AppListItem,
  MarketAvailabilityResult,
  parseStoreUrl,
  SnapshotDiffResult,
  SUPPORTED_STORES,
} from '@asobeast/shared';
import { ChangesService } from '../changes/changes.service';
import { DiffableChangeSnapshot } from '../changes/change-detector';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { StoreNotSupportedError } from '../store-providers/errors';
import {
  releaseNotesFor,
  screenshotsCount,
} from '../store-providers/raw-facts';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import {
  JOBS,
  QUEUES,
  queueNameForStore,
  reviewsBackfillJobId,
} from '../jobs/jobs.types';
import { AppCaptureService } from './app-capture.service';
import { QuotaService } from '../auth/quota.service';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { toAppDetail, toAppListItem, toSnapshotData } from './apps.mapper';
import { FirstRunScheduler } from './first-run.scheduler';
import { diffSnapshots } from './snapshot-diff';

const REVIEW_BACKFILL_PAGES = 3;

@Injectable()
export class AppsService {
  private readonly logger = new Logger(AppsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly capture: AppCaptureService,
    private readonly keywords: KeywordsService,
    private readonly changes: ChangesService,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly quota: QuotaService,
    private readonly egress: ProxyEgress,
    private readonly workspace: WorkspaceContext,
    private readonly firstRun: FirstRunScheduler,
  ) {}

  private queueFor(store: Store): Queue {
    return queueNameForStore(store) === QUEUES.GPLAY
      ? this.gplayQueue
      : this.appStoreQueue;
  }

  async importFromUrl(url: string, country?: string): Promise<AppDetail> {
    const { store, storeAppId, country: parsedCountry } = parseStoreUrl(url);

    if (!SUPPORTED_STORES.includes(store)) {
      throw new StoreNotSupportedError(store);
    }
    const known = await this.prisma.app.findFirst({
      where: {
        store,
        storeAppId,
        country: country ?? parsedCountry,
        isCompetitor: false,
      },
      select: { id: true },
    });
    if (known) {
      return this.detail(known.id);
    }
    await this.quota.assertRoom('apps');

    const { app, snapshot } = await this.capture.capture(
      store,
      storeAppId,
      country ?? parsedCountry,
      { admit: this.quota.admitApp() },
    );

    await this.keywords.syncFromSnapshot(app.id);

    await this.queueFor(store).add(
      JOBS.SYNC_REVIEWS,
      {
        appId: app.id,
        pages: REVIEW_BACKFILL_PAGES,
        backfill: true,
        workspaceId: app.workspaceId,
        correlationId: this.workspace.correlationId,
      },
      { jobId: reviewsBackfillJobId(app.id) },
    );

    await this.scheduleFirstRun(app.id);

    return toAppDetail(app, snapshot, [], null);
  }

  private async scheduleFirstRun(appId: string): Promise<void> {
    try {
      await this.firstRun.schedule(appId);
    } catch (error: unknown) {
      this.logger.error(
        `could not schedule the first run for ${appId}, so its positions wait for the next daily run: ${reason(error)}`,
      );
    }
  }

  async list(): Promise<AppListItem[]> {
    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false },
      include: {
        snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
        _count: { select: { tracked: true, competitors: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apps.map((app) =>
      toAppListItem(
        app,
        app.snapshots[0] ?? null,
        app._count.tracked,
        app._count.competitors,
      ),
    );
  }

  async detail(id: string): Promise<AppDetail> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      include: {
        snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
        competitors: {
          include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } },
          orderBy: { createdAt: 'asc' },
        },
        group: { include: { apps: true } },
      },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    return toAppDetail(
      app,
      app.snapshots[0] ?? null,
      app.competitors,
      app.group,
    );
  }

  async marketAvailability(
    id: string,
    country: string,
  ): Promise<MarketAvailabilityResult> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      select: { store: true, storeAppId: true, country: true },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    if (app.country === country) {
      return { country, status: 'available' };
    }

    const [result] = await this.egress.through(app.store, country, () =>
      this.registry.get(app.store).availability(app.storeAppId, [country]),
    );

    return result ?? { country, status: 'unknown' };
  }

  private async ensureApp(id: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }
  }

  async remove(id: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      select: { id: true, groupId: true },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    await this.prisma.withTransaction(async (tx) => {
      await tx.app.delete({ where: { id: app.id } });
      if (app.groupId) {
        const remaining = await tx.app.count({
          where: { groupId: app.groupId },
        });
        if (remaining < 2) {
          await tx.app.updateMany({
            where: { groupId: app.groupId },
            data: { groupId: null },
          });
          await tx.appGroup.delete({ where: { id: app.groupId } });
        }
      }
    });
  }

  async refreshApp(id: string): Promise<SnapshotDiffResult> {
    const app = await this.prisma.app.findFirst({
      where: { id },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    const normalized = await this.egress.through(app.store, app.country, () =>
      this.registry.get(app.store).getApp(app.storeAppId, app.country),
    );

    const previous = await this.prisma.appSnapshot.findFirst({
      where: { appId: app.id },
      orderBy: { capturedAt: 'desc' },
    });

    const snapshot = await this.prisma.withTransaction(async (tx) => {
      const created = await tx.appSnapshot.create({
        data: toSnapshotData(app.id, normalized),
      });
      await tx.app.update({
        where: { id: app.id },
        data: { name: normalized.title, iconUrl: normalized.iconUrl },
      });
      return created;
    });

    await this.keywords.syncFromSnapshot(app.id);

    await this.changes.recordRefresh(
      app.id,
      previous ? this.toChangeSnapshot(previous, app.iconUrl, app.store) : null,
      this.toChangeSnapshot(snapshot, normalized.iconUrl ?? null, app.store),
    );

    return {
      snapshotId: snapshot.id,
      changes: diffSnapshots(previous, snapshot),
    };
  }

  private toChangeSnapshot(
    snapshot: AppSnapshot,
    iconUrl: string | null,
    store: Store,
  ): DiffableChangeSnapshot {
    return {
      title: snapshot.title,
      subtitle: snapshot.subtitle,
      summary: snapshot.summary,
      description: snapshot.description,
      version: snapshot.version,
      price: snapshot.price,
      screenshotsCount: screenshotsCount(snapshot.raw),
      iconUrl,
      releaseNotes: releaseNotesFor(store, snapshot.raw),
    };
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
