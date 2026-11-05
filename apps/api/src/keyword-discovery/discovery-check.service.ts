import { Injectable } from '@nestjs/common';
import { isDiscoverySource, RANK_DEPTH } from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { DiscoverKeywordPayload } from '../jobs/jobs.types';
import { listingFacts } from '../keywords/listing-facts';
import { KeywordApp } from '../keywords/keywords.support';
import { PrismaService } from '../prisma/prisma.service';
import { positionsByStoreAppId, SerpCapture } from '../rankings/serp-capture';
import { toDateKey, utcToday } from '../rankings/rankings.support';
import { discoveryRelevance } from './discovery-pool';
import { DiscoveryTracker } from './discovery-tracker.service';

const CHECKED_APP_SELECT = {
  id: true,
  workspaceId: true,
  store: true,
  country: true,
  storeAppId: true,
  delistedAt: true,
  unlistedMarkets: true,
  autoTrackRanked: true,
} as const;

@Injectable()
export class DiscoveryCheck {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capture: SerpCapture,
    private readonly tracker: DiscoveryTracker,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  async run(
    { appId, keywordId }: DiscoverKeywordPayload,
    finalAttempt: boolean,
  ): Promise<void> {
    const row = await this.prisma.keywordDiscovery.findFirst({
      where: {
        appId,
        keywordId,
        dismissedAt: null,
        keyword: { tracked: { none: { appId } } },
      },
      include: { keyword: true, app: { select: CHECKED_APP_SELECT } },
    });
    if (!row || !isDiscoverySource(row.source)) return;
    const { keyword, app, source } = row;
    if (app.delistedAt || app.unlistedMarkets.includes(keyword.country)) {
      return;
    }
    const results = await this.capture.search(keyword, finalAttempt);
    if (!results) return;
    const position = positionsByStoreAppId(results).get(app.storeAppId) ?? null;
    const date = utcToday();
    if (await this.nobodyTracks(keywordId)) {
      await this.capture.store(keywordId, date, results);
    }
    const relevance = discoveryRelevance(
      source,
      keyword.text,
      await this.listingText(app, keyword.country),
      { position, checked: true },
    );
    await this.prisma.keywordDiscovery.update({
      where: { appId_keywordId: { appId, keywordId } },
      data: { position, depth: RANK_DEPTH, checkedOn: date, relevance },
    });
    if (!app.autoTrackRanked || position === null) return;
    await this.tracker.autoTrack(app, [
      {
        keywordId,
        text: keyword.text,
        country: keyword.country,
        source,
        position,
        depth: RANK_DEPTH,
        checkedOn: toDateKey(date),
      },
    ]);
  }

  private async nobodyTracks(keywordId: string): Promise<boolean> {
    const trackers =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        'a keyword nobody tracks has no entrant baseline to protect',
        () =>
          this.prisma.trackedKeyword.count({
            where: { keywordId, active: true },
          }),
      );
    return trackers === 0;
  }

  private async listingText(app: KeywordApp, market: string): Promise<string> {
    const facts = await listingFacts(this.prisma, app, [market]);
    return facts.marketTexts?.get(market) ?? facts.snapshotText;
  }
}
