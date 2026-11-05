import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  DiscoverySource,
  isDiscoverySource,
  KeywordDiscoveryRefreshResult,
  utcDayOf,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { DEFERRED_JOB_OPTIONS } from '../jobs/job-options';
import {
  DiscoverKeywordPayload,
  discoverKeywordJobId,
  isoWeekKey,
  JOBS,
  QUEUES,
} from '../jobs/jobs.types';
import { loadAppMarkets } from '../keywords/app-markets';
import { listingFacts } from '../keywords/listing-facts';
import {
  ensurePrimaryApp,
  KeywordApp,
  queueFor,
} from '../keywords/keywords.support';
import { PrismaService } from '../prisma/prisma.service';
import { captureResolves, DiscoveryCaptures } from './discovery-captures';
import { discoveryRelevance } from './discovery-pool';
import { DiscoveryPoolStore } from './discovery-pool-store';
import {
  isDue,
  remainingChecks,
  ScheduledRow,
  selectChecks,
  weekStartOf,
} from './discovery-schedule';

const DISCOVERY_LOCK = 2_846_509;

export const COMPETITOR_REFUSAL =
  'A competitor app has no keyword discoveries; use its primary app';

interface OpenRow extends ScheduledRow {
  source: DiscoverySource;
}

interface Readings {
  rows: OpenRow[];
  resolved: number;
}

type ListingTextOf = (market: string) => string;

const utcDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

@Injectable()
export class KeywordDiscoveryPlanner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pool: DiscoveryPoolStore,
    private readonly captures: DiscoveryCaptures,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async plan(
    appId: string,
    spend?: () => Promise<void>,
    now = new Date(),
  ): Promise<KeywordDiscoveryRefreshResult> {
    const app = await ensurePrimaryApp(this.prisma, appId, COMPETITOR_REFUSAL);
    const listing = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { delistedAt: true, unlistedMarkets: true },
    });
    const today = utcDayOf(now);
    const markets = await loadAppMarkets(this.prisma, app);
    const facts = await listingFacts(this.prisma, app, markets);
    const listingTextOf: ListingTextOf = (market) =>
      facts.marketTexts?.get(market) ?? facts.snapshotText;
    for (const market of markets) {
      await this.pool.store(app, market, listingTextOf(market), now);
    }
    const open = await this.openRows(app.id, listing?.unlistedMarkets ?? []);
    const { rows, resolved } = await this.applyCaptures(
      app,
      open,
      today,
      listingTextOf,
    );
    if (listing?.delistedAt) return { queued: 0, resolved };
    const selected = await this.reserve(app, rows, now, today);
    if (selected.length === 0) return { queued: 0, resolved };
    try {
      await spend?.();
      await this.enqueue(app, selected, now);
    } catch (error: unknown) {
      await this.release(app.id, selected, now);
      throw error;
    }
    return { queued: selected.length, resolved };
  }

  private async openRows(
    appId: string,
    unlistedMarkets: readonly string[],
  ): Promise<OpenRow[]> {
    const rows = await this.prisma.keywordDiscovery.findMany({
      where: {
        appId,
        dismissedAt: null,
        keyword: {
          tracked: { none: { appId } },
          country: { notIn: [...unlistedMarkets] },
        },
      },
      select: {
        keywordId: true,
        source: true,
        relevance: true,
        position: true,
        depth: true,
        checkedOn: true,
        keyword: { select: { text: true, country: true } },
      },
    });
    return rows.flatMap(({ source, keyword, checkedOn, ...row }) =>
      isDiscoverySource(source)
        ? [
            {
              ...row,
              source,
              text: keyword.text,
              country: keyword.country,
              checkedOn: checkedOn === null ? null : utcDayOf(checkedOn),
              dismissed: false,
            },
          ]
        : [],
    );
  }

  private async applyCaptures(
    app: KeywordApp,
    open: readonly OpenRow[],
    today: string,
    listingTextOf: ListingTextOf,
  ): Promise<Readings> {
    const due = open.filter((row) => isDue(row, today));
    const readings = await this.captures.read(
      app.storeAppId,
      due.map(({ keywordId }) => keywordId),
      today,
    );
    let resolved = 0;
    const rows: OpenRow[] = [];
    for (const row of open) {
      const reading = readings.get(row.keywordId);
      if (!reading) {
        rows.push(row);
        continue;
      }
      if (captureResolves(reading)) resolved += 1;
      const read = { ...row, ...reading };
      rows.push(read);
      if (
        row.checkedOn === reading.checkedOn &&
        row.position === reading.position &&
        row.depth === reading.depth
      ) {
        continue;
      }
      await this.prisma.keywordDiscovery.update({
        where: { appId_keywordId: { appId: app.id, keywordId: row.keywordId } },
        data: {
          position: reading.position,
          depth: reading.depth,
          checkedOn: utcDate(reading.checkedOn),
          relevance: discoveryRelevance(
            row.source,
            row.text,
            listingTextOf(row.country),
            { position: reading.position, checked: true },
          ),
        },
      });
    }
    return { rows, resolved };
  }

  private reserve(
    app: KeywordApp,
    rows: readonly OpenRow[],
    now: Date,
    today: string,
  ): Promise<OpenRow[]> {
    return this.prisma.withTransaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DISCOVERY_LOCK}::int, hashtext(${app.id}))`;
      const queued = await tx.keywordDiscovery.findMany({
        where: { appId: app.id, queuedAt: { gte: weekStartOf(now) } },
        select: { keywordId: true },
      });
      const taken = new Set(queued.map(({ keywordId }) => keywordId));
      const selected = selectChecks(
        rows.filter(({ keywordId }) => !taken.has(keywordId)),
        remainingChecks(app.store, queued.length),
        today,
      );
      if (selected.length > 0) {
        await tx.keywordDiscovery.updateMany({
          where: {
            appId: app.id,
            keywordId: { in: selected.map(({ keywordId }) => keywordId) },
          },
          data: { queuedAt: now },
        });
      }
      return selected;
    });
  }

  private async enqueue(
    app: KeywordApp,
    selected: readonly OpenRow[],
    now: Date,
  ): Promise<void> {
    const week = isoWeekKey(now);
    await queueFor(app.store, this.appStoreQueue, this.gplayQueue).addBulk(
      selected.map(({ keywordId }) => ({
        name: JOBS.DISCOVER_KEYWORD,
        data: {
          appId: app.id,
          keywordId,
          workspaceId: app.workspaceId,
          correlationId: this.workspace.correlationId,
        } satisfies DiscoverKeywordPayload,
        opts: {
          ...DEFERRED_JOB_OPTIONS,
          jobId: discoverKeywordJobId(app.id, keywordId, week),
        },
      })),
    );
  }

  private async release(
    appId: string,
    selected: readonly OpenRow[],
    now: Date,
  ): Promise<void> {
    await this.prisma.keywordDiscovery.updateMany({
      where: {
        appId,
        keywordId: { in: selected.map(({ keywordId }) => keywordId) },
        queuedAt: now,
      },
      data: { queuedAt: null },
    });
  }
}
