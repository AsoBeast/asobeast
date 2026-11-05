import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  isDiscoverySource,
  KeywordDiscoveryDismissResult,
  KeywordDiscoveryRefreshResult,
  KeywordDiscoverySettings,
  KeywordDiscoveryTrackRequest,
  KeywordDiscoveryTrackResult,
  utcDayOf,
} from '@asobeast/shared';
import { ensurePrimaryApp, KeywordApp } from '../keywords/keywords.support';
import { PrismaService } from '../prisma/prisma.service';
import {
  COMPETITOR_REFUSAL,
  KeywordDiscoveryPlanner,
} from './discovery-planner.service';
import { TrackRow } from './discovery-track-plan';
import { DiscoveryTracker } from './discovery-tracker.service';

const TRACK_TARGET_REFUSAL =
  'Name the discoveries to track with keywordIds or set allRanked to true, not both';

type TrackTarget =
  | { keywordIds: string[]; country?: string }
  | { allRanked: true; country?: string };

export function trackTargetOf({
  keywordIds,
  allRanked,
  country,
}: KeywordDiscoveryTrackRequest): TrackTarget {
  if (keywordIds !== undefined && allRanked === undefined) {
    return { keywordIds, country };
  }
  if (keywordIds === undefined && allRanked === true) {
    return { allRanked, country };
  }
  throw new BadRequestException(TRACK_TARGET_REFUSAL);
}

const TRACK_ROW_SELECT = {
  keywordId: true,
  source: true,
  position: true,
  depth: true,
  checkedOn: true,
  keyword: { select: { text: true, country: true } },
} as const;

type StoredTrackRow = Prisma.KeywordDiscoveryGetPayload<{
  select: typeof TRACK_ROW_SELECT;
}>;

const trackRowsOf = (rows: readonly StoredTrackRow[]): TrackRow[] =>
  rows.flatMap(({ source, keyword, checkedOn, ...row }) =>
    isDiscoverySource(source)
      ? [
          {
            ...row,
            source,
            text: keyword.text,
            country: keyword.country,
            checkedOn: checkedOn === null ? null : utcDayOf(checkedOn),
          },
        ]
      : [],
  );

@Injectable()
export class KeywordDiscoveryActions {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracker: DiscoveryTracker,
    private readonly planner: KeywordDiscoveryPlanner,
  ) {}

  async track(
    appId: string,
    request: KeywordDiscoveryTrackRequest,
  ): Promise<KeywordDiscoveryTrackResult> {
    const target = trackTargetOf(request);
    const app = await this.primaryApp(appId);
    return this.trackOpen(
      app,
      'keywordIds' in target
        ? { keywordId: { in: target.keywordIds } }
        : { position: { not: null } },
      target.country,
    );
  }

  async dismiss(
    appId: string,
    keywordIds: readonly string[],
    now = new Date(),
  ): Promise<KeywordDiscoveryDismissResult> {
    await this.primaryApp(appId);
    const { count } = await this.prisma.keywordDiscovery.updateMany({
      where: { appId, keywordId: { in: [...keywordIds] }, dismissedAt: null },
      data: { dismissedAt: now },
    });
    return { dismissed: count };
  }

  refresh(
    appId: string,
    spend: () => Promise<void>,
  ): Promise<KeywordDiscoveryRefreshResult> {
    return this.planner.plan(appId, spend);
  }

  async updateSettings(
    appId: string,
    autoTrackRanked: boolean,
  ): Promise<KeywordDiscoverySettings> {
    const app = await this.primaryApp(appId);
    const result = autoTrackRanked
      ? await this.trackOpen(app, { position: { not: null } })
      : { tracked: 0, skipped: 0 };
    await this.prisma.app.update({
      where: { id: appId },
      data: { autoTrackRanked },
    });
    if (autoTrackRanked) {
      await this.tracker.autoTrack(app, await this.openRanked(app));
    }
    return { autoTrackRanked, ...result };
  }

  private async trackOpen(
    app: KeywordApp,
    filter: Prisma.KeywordDiscoveryWhereInput,
    country?: string,
  ): Promise<KeywordDiscoveryTrackResult> {
    return this.tracker.trackRows(
      app,
      await this.openRows(app, filter, country),
    );
  }

  private openRanked(app: KeywordApp): Promise<TrackRow[]> {
    return this.openRows(app, { position: { not: null } });
  }

  private async openRows(
    app: KeywordApp,
    filter: Prisma.KeywordDiscoveryWhereInput,
    country?: string,
  ): Promise<TrackRow[]> {
    const rows = await this.prisma.keywordDiscovery.findMany({
      where: {
        ...filter,
        appId: app.id,
        dismissedAt: null,
        keyword: {
          tracked: { none: { appId: app.id } },
          ...(country ? { country } : {}),
        },
      },
      orderBy: [{ relevance: 'desc' }, { keyword: { text: 'asc' } }],
      select: TRACK_ROW_SELECT,
    });
    return trackRowsOf(rows);
  }

  private primaryApp(appId: string): Promise<KeywordApp> {
    return ensurePrimaryApp(this.prisma, appId, COMPETITOR_REFUSAL);
  }
}
