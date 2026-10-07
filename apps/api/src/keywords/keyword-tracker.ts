import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { isoWeekKey, JOBS, QUEUES, scoreJobId } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { pairKey } from './keyword-import';
import { KeywordApp, queueFor } from './keywords.support';

export const keywordRows = (texts: string[], store: Store, country: string) =>
  [...texts].sort().map((text) => ({ text, store, country }));

export interface KeywordPair {
  text: string;
  country: string;
}

type ScoredApp = Pick<KeywordApp, 'store' | 'workspaceId'>;

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const byTextThenCountry = (left: KeywordPair, right: KeywordPair): number =>
  compareText(left.text, right.text) ||
  compareText(left.country, right.country);

function textsByCountry(pairs: readonly KeywordPair[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const { text, country } of pairs) {
    const texts = grouped.get(country) ?? [];
    texts.push(text);
    grouped.set(country, texts);
  }
  return grouped;
}

@Injectable()
export class KeywordTracker {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async enqueueFirstScore(keywordId: string, app: ScoredApp): Promise<void> {
    const existing = await this.prisma.keywordMetric.findFirst({
      where: { keywordId },
      select: { keywordId: true },
    });
    if (existing) {
      return;
    }
    await this.queueOf(app).add(
      JOBS.SCORE_KEYWORD,
      this.scoreData(keywordId, app),
      this.scoreOptions(keywordId),
    );
  }

  async enqueueFirstScores(
    keywordIds: readonly string[],
    app: ScoredApp,
  ): Promise<void> {
    if (keywordIds.length === 0) {
      return;
    }
    const scored = await this.prisma.keywordMetric.findMany({
      where: { keywordId: { in: [...keywordIds] } },
      select: { keywordId: true },
      distinct: ['keywordId'],
    });
    const skip = new Set(scored.map(({ keywordId }) => keywordId));
    const unscored = keywordIds.filter((keywordId) => !skip.has(keywordId));
    if (unscored.length === 0) {
      return;
    }
    await this.queueOf(app).addBulk(
      unscored.map((keywordId) => ({
        name: JOBS.SCORE_KEYWORD,
        data: this.scoreData(keywordId, app),
        opts: this.scoreOptions(keywordId),
      })),
    );
  }

  async keywordIdsAcrossMarkets(
    pairs: readonly KeywordPair[],
    store: Store,
  ): Promise<Map<string, string>> {
    await this.prisma.keyword.createMany({
      data: [...pairs]
        .sort(byTextThenCountry)
        .map(({ text, country }) => ({ text, store, country })),
      skipDuplicates: true,
    });
    const keywords = await this.prisma.keyword.findMany({
      where: {
        store,
        OR: [...textsByCountry(pairs)].map(([country, texts]) => ({
          country,
          text: { in: texts },
        })),
      },
      select: { id: true, text: true, country: true },
    });
    return new Map(
      keywords.map((keyword) => [
        pairKey(keyword.country, keyword.text),
        keyword.id,
      ]),
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

  private queueOf(app: ScoredApp): Queue {
    return queueFor(app.store, this.appStoreQueue, this.gplayQueue);
  }

  private scoreData(keywordId: string, app: ScoredApp) {
    return {
      keywordId,
      workspaceId: app.workspaceId,
      correlationId: this.workspace.correlationId,
    };
  }

  private scoreOptions(keywordId: string) {
    return { jobId: scoreJobId(keywordId, isoWeekKey()) };
  }
}
