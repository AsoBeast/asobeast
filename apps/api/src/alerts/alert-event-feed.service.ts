import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ALERT_FEED_EVENTS,
  type AlertEventItem,
  type AlertEventList,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  decodeCursor,
  encodeCursor,
  type FeedCursor,
} from './alert-event-cursor';
import {
  primaryAppOf,
  REMOVED_APP,
  toAlertEventItem,
  type FeedRow,
  type LiveApp,
} from './alert-event-item';
import { feedWhere, feedWindowStart } from './alert-feed-where';
import { ListAlertEventsQueryDto } from './dto/list-alert-events-query.dto';

interface FeedScope {
  appIds: string[] | null;
  keywordIds: string[];
  preferred: string | null;
}

interface FeedHomes {
  live: ReadonlyMap<string, LiveApp>;
  trackers: ReadonlyMap<string, readonly string[]>;
}

const UNSCOPED: FeedScope = { appIds: null, keywordIds: [], preferred: null };

const distinct = (values: (string | null)[]): string[] => [
  ...new Set(values.filter((value): value is string => value !== null)),
];

@Injectable()
export class AlertEventFeed {
  private readonly logger = new Logger(AlertEventFeed.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListAlertEventsQueryDto,
    now = new Date(),
  ): Promise<AlertEventList> {
    const cursor = this.cursorOf(query.cursor);
    const scope = await this.scopeOf(query.appId);
    const rows = await this.prisma.alertEvent.findMany({
      where: feedWhere({
        types: query.type ?? ALERT_FEED_EVENTS,
        since: feedWindowStart(now),
        after: query.since ? new Date(query.since) : null,
        appIds: scope.appIds,
        keywordIds: scope.keywordIds,
        cursor,
      }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: {
        id: true,
        event: true,
        appId: true,
        keywordId: true,
        payload: true,
        createdAt: true,
      },
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      events: this.itemsOf(page, await this.homesOf(page), scope.preferred),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
    };
  }

  private cursorOf(value: string | undefined): FeedCursor | null {
    if (value === undefined) return null;
    const cursor = decodeCursor(value);
    if (!cursor) throw new BadRequestException('cursor is not valid');
    return cursor;
  }

  private async scopeOf(appId: string | undefined): Promise<FeedScope> {
    if (appId === undefined) return UNSCOPED;
    const apps = await this.prisma.app.findMany({
      where: { OR: [{ id: appId }, { primaryAppId: appId }] },
      select: { id: true },
    });
    if (!apps.some((app) => app.id === appId)) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      select: { keywordId: true },
    });
    return {
      appIds: apps.map((app) => app.id),
      keywordIds: tracked.map((row) => row.keywordId),
      preferred: appId,
    };
  }

  private async homesOf(page: FeedRow[]): Promise<FeedHomes> {
    const appIds = distinct(page.map((row) => row.appId));
    const keywordIds = distinct(
      page.map((row) => (row.appId === null ? row.keywordId : null)),
    );
    const [apps, tracked] = await Promise.all([
      appIds.length === 0
        ? []
        : this.prisma.app.findMany({
            where: { id: { in: appIds } },
            select: { id: true, primaryAppId: true },
          }),
      keywordIds.length === 0
        ? []
        : this.prisma.trackedKeyword.findMany({
            where: {
              keywordId: { in: keywordIds },
              active: true,
              app: { isCompetitor: false },
            },
            select: { keywordId: true, appId: true },
            orderBy: { appId: 'asc' },
          }),
    ]);
    const trackers = new Map<string, string[]>();
    for (const row of tracked) {
      trackers.set(row.keywordId, [
        ...(trackers.get(row.keywordId) ?? []),
        row.appId,
      ]);
    }
    return { live: new Map(apps.map((app) => [app.id, app])), trackers };
  }

  private itemsOf(
    page: FeedRow[],
    homes: FeedHomes,
    preferred: string | null,
  ): AlertEventItem[] {
    return page.flatMap((row) => {
      const home = primaryAppOf({ row, preferred, ...homes });
      if (home === REMOVED_APP) return [];
      const item = toAlertEventItem(row, home);
      if (item === null) {
        this.logger.warn(`alert event ${row.id} is unreadable, skipping it`);
        return [];
      }
      return [item];
    });
  }
}
