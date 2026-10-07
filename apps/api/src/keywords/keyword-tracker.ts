import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { isoWeekKey, JOBS, QUEUES, scoreJobId } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordApp, queueFor } from './keywords.support';

export const keywordRows = (texts: string[], store: Store, country: string) =>
  [...texts].sort().map((text) => ({ text, store, country }));

@Injectable()
export class KeywordTracker {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async enqueueFirstScore(
    keywordId: string,
    app: Pick<KeywordApp, 'store' | 'workspaceId'>,
  ): Promise<void> {
    const existing = await this.prisma.keywordMetric.findFirst({
      where: { keywordId },
      select: { keywordId: true },
    });
    if (existing) {
      return;
    }
    await queueFor(app.store, this.appStoreQueue, this.gplayQueue).add(
      JOBS.SCORE_KEYWORD,
      {
        keywordId,
        workspaceId: app.workspaceId,
        correlationId: this.workspace.correlationId,
      },
      { jobId: scoreJobId(keywordId, isoWeekKey()) },
    );
  }

  async keywordIdMap(
    texts: string[],
    store: Store,
    country: string,
  ): Promise<Map<string, string>> {
    await this.prisma.keyword.createMany({
      data: keywordRows(texts, store, country),
      skipDuplicates: true,
    });
    const keywords = await this.prisma.keyword.findMany({
      where: { store, country, text: { in: texts } },
      select: { id: true, text: true },
    });
    return new Map(keywords.map((keyword) => [keyword.text, keyword.id]));
  }

  async keywordIdsFor(
    texts: string[],
    store: Store,
    country: string,
  ): Promise<string[]> {
    const idByText = await this.keywordIdMap(texts, store, country);
    return texts.flatMap((text) => {
      const id = idByText.get(text);
      return id ? [id] : [];
    });
  }

  claimForManual(
    client: Prisma.TransactionClient,
    appId: string,
    keywordIds: string[],
  ): Promise<Prisma.BatchPayload> {
    return client.trackedKeyword.updateMany({
      where: { appId, keywordId: { in: keywordIds }, source: 'KEYWORD_FIELD' },
      data: { source: 'MANUAL' },
    });
  }

  async track(
    client: Prisma.TransactionClient | PrismaService,
    row: Prisma.TrackedKeywordCreateManyInput,
    onExisting: Prisma.TrackedKeywordUpdateManyMutationInput,
  ): Promise<void> {
    const { count } = await client.trackedKeyword.createMany({
      data: [row],
      skipDuplicates: true,
    });
    if (count > 0) {
      return;
    }
    await client.trackedKeyword.updateMany({
      where: { appId: row.appId, keywordId: row.keywordId },
      data: onExisting,
    });
  }
}
