import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { SpiderEnqueueResult, SpiderStatus } from '@asobeast/shared';
import {
  JOBS,
  QUEUES,
  SpiderProbePayload,
  spiderJobId,
  utcDateKey,
} from '../jobs/jobs.types';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { SuggestItem } from '../store-providers/types';
import { ensureApp, queueFor, trackedTexts } from './keywords.support';
import { aggregateSpider, SPIDER_PROBES, spiderQuery } from './spider';

@Injectable()
export class SpiderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async startSpider(
    appId: string,
    term: string,
    country?: string,
  ): Promise<SpiderEnqueueResult> {
    const app = await ensureApp(this.prisma, appId);
    const market = country ?? app.country;
    const date = utcDateKey();
    const day = spiderDay(date);

    const existing = await this.prisma.suggestProbe.findMany({
      where: { appId, term, country: market, day },
      select: { probe: true },
    });
    const done = new Set(existing.map((row) => row.probe));

    let enqueued = 0;
    for (const probe of SPIDER_PROBES) {
      if (done.has(probe)) {
        continue;
      }
      await queueFor(app.store, this.appStoreQueue, this.gplayQueue).add(
        JOBS.SPIDER_PROBE,
        {
          appId,
          term,
          country: market,
          probe,
          workspaceId: app.workspaceId,
          correlationId: this.workspace.correlationId,
        } satisfies SpiderProbePayload,
        { jobId: spiderJobId(appId, term, market, probe, date) },
      );
      enqueued += 1;
    }

    return { enqueued };
  }

  async spiderStatus(
    appId: string,
    term: string,
    country?: string,
  ): Promise<SpiderStatus> {
    const app = await ensureApp(this.prisma, appId);
    const market = country ?? app.country;
    const day = spiderDay(utcDateKey());

    const [rows, tracked] = await Promise.all([
      this.prisma.suggestProbe.findMany({
        where: { appId, term, country: market, day },
        select: { probe: true, results: true },
      }),
      trackedTexts(this.prisma, appId, market),
    ]);

    return aggregateSpider(
      term,
      rows.map((row) => ({
        probe: row.probe,
        results: (row.results as unknown as SuggestItem[]) ?? [],
      })),
      tracked,
    );
  }

  async runSpiderProbe(payload: SpiderProbePayload): Promise<void> {
    const { appId, term, probe } = payload;
    const app = await ensureApp(this.prisma, appId);
    const country = payload.country ?? app.country;
    const provider = this.registry.get(app.store);
    const results = await provider.suggest(spiderQuery(term, probe), country);
    const day = spiderDay(utcDateKey());

    const stored = results as unknown as Prisma.InputJsonValue;
    await this.prisma.suggestProbe.upsert({
      where: {
        appId_term_country_day_probe: { appId, term, country, day, probe },
      },
      create: { appId, term, country, day, probe, results: stored },
      update: { results: stored },
    });
  }
}

function spiderDay(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
