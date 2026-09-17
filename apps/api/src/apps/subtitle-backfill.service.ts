import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { App, AppSnapshot } from '@prisma/client';
import { JobsOptions, Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JOB_OPTIONS } from '../jobs/job-options';
import {
  JOBS,
  QUEUES,
  ResolveSubtitlePayload,
  resolveSubtitleJobId,
} from '../jobs/jobs.types';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { StoreRequestError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';

const RESOLVE_SUBTITLE_OPTIONS = {
  ...JOB_OPTIONS,
  attempts: 6,
  delay: 15_000,
  backoff: { type: 'exponential', delay: 15_000, jitter: 0.5 },
} satisfies JobsOptions;

@Injectable()
export class SubtitleBackfill {
  private readonly logger = new Logger(SubtitleBackfill.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly keywords: KeywordsService,
    private readonly workspace: WorkspaceContext,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
  ) {}

  async request(app: App, snapshot: AppSnapshot): Promise<void> {
    const payload: ResolveSubtitlePayload = {
      ...this.workspace.scopeFor('a subtitle backfill'),
      appId: app.id,
      snapshotId: snapshot.id,
    };
    try {
      await this.appStoreQueue.add(JOBS.RESOLVE_SUBTITLE, payload, {
        ...RESOLVE_SUBTITLE_OPTIONS,
        jobId: resolveSubtitleJobId(app.id),
      });
    } catch (error: unknown) {
      this.logger.error(
        `could not queue the subtitle backfill for ${app.id}, so its subtitle waits for the next refresh: ${reason(error)}`,
      );
    }
  }

  async resolve({ appId, snapshotId }: ResolveSubtitlePayload): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { store: true, storeAppId: true, country: true },
    });
    const imported = await this.prisma.appSnapshot.findFirst({
      where: { id: snapshotId, appId },
      select: { capturedAt: true },
    });
    if (!app || !imported) return;

    const listing = await this.registry
      .get(app.store)
      .getApp(app.storeAppId, app.country);
    if (listing.subtitleUnavailable) {
      throw new StoreRequestError(
        app.store,
        'page',
        'the product page is still unreadable',
      );
    }
    if (listing.subtitle === undefined) return;

    const { count } = await this.prisma.appSnapshot.updateMany({
      where: {
        appId,
        subtitle: null,
        capturedAt: { gte: imported.capturedAt },
      },
      data: { subtitle: listing.subtitle },
    });
    if (count > 0) {
      await this.keywords.syncFromSnapshot(appId);
    }
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
