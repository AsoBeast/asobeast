import { Injectable } from '@nestjs/common';
import { DiscoverySource } from '@asobeast/shared';
import { KeywordTracker } from '../keywords/keyword-tracker';
import { KeywordApp, trackedTexts } from '../keywords/keywords.support';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryCandidates } from './discovery-candidates.service';
import { buildPool, discoveryRelevance } from './discovery-pool';

interface ProposedRow {
  keywordId: string;
  text: string;
  source: DiscoverySource;
  relevance: number;
}

interface StoredRow {
  keywordId: string;
  source: string;
  relevance: number;
  position: number | null;
  checkedOn: Date | null;
}

const observedRelevance = (
  proposed: ProposedRow,
  stored: StoredRow,
  listingText: string,
): number =>
  stored.checkedOn === null
    ? proposed.relevance
    : discoveryRelevance(proposed.source, proposed.text, listingText, {
        position: stored.position,
        checked: true,
      });

@Injectable()
export class DiscoveryPoolStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: DiscoveryCandidates,
    private readonly tracker: KeywordTracker,
  ) {}

  async store(
    app: KeywordApp,
    market: string,
    listingText: string,
    now: Date,
  ): Promise<number> {
    const pool = buildPool(
      await this.candidates.forMarket(app, market, listingText),
      { excluded: await this.excludedTexts(app.id, market) },
    );
    if (pool.length === 0) return 0;
    const ids = await this.tracker.keywordIdMap(
      pool.map(({ text }) => text),
      app.store,
      market,
    );
    const proposed = pool.flatMap(({ text, source, relevance }) => {
      const keywordId = ids.get(text);
      return keywordId ? [{ keywordId, text, source, relevance }] : [];
    });
    await this.write(app, proposed, listingText, now);
    return proposed.length;
  }

  private async excludedTexts(
    appId: string,
    market: string,
  ): Promise<Set<string>> {
    const [tracked, dismissed] = await Promise.all([
      trackedTexts(this.prisma, appId, market),
      this.prisma.keywordDiscovery.findMany({
        where: {
          appId,
          dismissedAt: { not: null },
          keyword: { country: market },
        },
        select: { keyword: { select: { text: true } } },
      }),
    ]);
    return new Set([
      ...tracked,
      ...dismissed.map(({ keyword }) => keyword.text),
    ]);
  }

  private async write(
    app: KeywordApp,
    proposed: readonly ProposedRow[],
    listingText: string,
    now: Date,
  ): Promise<void> {
    const keywordIds = proposed.map(({ keywordId }) => keywordId);
    const stored = new Map(
      (
        await this.prisma.keywordDiscovery.findMany({
          where: { appId: app.id, keywordId: { in: keywordIds } },
          select: {
            keywordId: true,
            source: true,
            relevance: true,
            position: true,
            checkedOn: true,
          },
        })
      ).map((row) => [row.keywordId, row]),
    );
    const fresh = proposed.filter(({ keywordId }) => !stored.has(keywordId));
    if (fresh.length > 0) {
      await this.prisma.keywordDiscovery.createMany({
        data: fresh.map(({ keywordId, source, relevance }) => ({
          appId: app.id,
          workspaceId: app.workspaceId,
          keywordId,
          source,
          relevance,
          seenAt: now,
        })),
        skipDuplicates: true,
      });
    }
    for (const row of proposed) {
      const known = stored.get(row.keywordId);
      if (!known) continue;
      const relevance = observedRelevance(row, known, listingText);
      if (known.source === row.source && known.relevance === relevance) {
        continue;
      }
      await this.prisma.keywordDiscovery.updateMany({
        where: {
          appId: app.id,
          keywordId: row.keywordId,
          checkedOn: known.checkedOn,
        },
        data: { source: row.source, relevance },
      });
    }
    await this.prisma.keywordDiscovery.updateMany({
      where: { appId: app.id, keywordId: { in: keywordIds } },
      data: { seenAt: now },
    });
  }
}
