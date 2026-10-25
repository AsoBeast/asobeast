import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertStorefront,
  ChangeEventItem,
  ChangeField,
  ChangeTimeline,
} from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { PrismaService } from '../prisma/prisma.service';
import { IconImageSource } from '../store-providers/icon-image';
import { readChangeDetail } from './change-detail';
import {
  DetectedChange,
  DiffableChangeSnapshot,
  detectChanges,
  truncateChangeText,
} from './change-detector';
import {
  eventsIn,
  eventsOfMarket,
  HOME_EVENTS,
  listingIn,
  listingMarket,
  NEWEST_FIRST,
  storedMarket,
} from '../apps/listing';
import { currencyOf } from '../store-providers/raw-facts';

const MAX_EVENTS = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const EVENT_SELECT = {
  id: true,
  appId: true,
  country: true,
  localization: true,
  field: true,
  before: true,
  after: true,
  detail: true,
  capturedAt: true,
  app: { select: { name: true, isCompetitor: true, country: true } },
} as const;

interface EventRow {
  id: string;
  appId: string;
  country: string | null;
  localization: string | null;
  field: string;
  before: string | null;
  after: string | null;
  detail: unknown;
  capturedAt: Date;
  app: { name: string | null; isCompetitor: boolean; country: string };
}

export interface CaptionChange {
  appId: string;
  listing: { home: string; market: string; localization: string | null };
  since: Date;
  before: string[];
  after: string[];
  added: string[];
  removed: string[];
}

const joined = (captions: string[]): string | null =>
  captions.length === 0 ? null : truncateChangeText(captions.join(' | '));

const eventData = (
  appId: string,
  { detail, ...change }: DetectedChange,
): Prisma.ChangeEventCreateManyInput => ({
  appId,
  ...change,
  ...(detail ? { detail: detail as unknown as Prisma.InputJsonValue } : {}),
});

const toChangeEventItem = (event: EventRow): ChangeEventItem => {
  const detail = readChangeDetail(event.detail);
  return {
    id: event.id,
    appId: event.appId,
    appName: event.app.name,
    isCompetitor: event.app.isCompetitor,
    field: event.field as ChangeField,
    before: event.before,
    after: event.after,
    capturedAt: event.capturedAt.toISOString(),
    country: listingMarket(event.app.country, event.country),
    ...(detail ? { detail } : {}),
    ...(event.localization ? { localization: event.localization } : {}),
  };
};

const listingKey = (event: EventRow): string =>
  `${event.appId}:${event.country ?? ''}`;

@Injectable()
export class ChangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsDispatcher,
    private readonly icons: IconImageSource,
  ) {}

  async timeline(
    appId: string,
    days: number,
    country?: string,
  ): Promise<ChangeTimeline> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        id: true,
        country: true,
        store: true,
        competitors: { select: { id: true } },
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const market = country ?? app.country;
    if (market !== app.country) {
      assertStorefront(app.store, market);
    }

    const appIds = [
      app.id,
      ...app.competitors.map((competitor) => competitor.id),
    ];
    const cutoff = new Date(Date.now() - days * DAY_MS);

    const events = await this.prisma.changeEvent.findMany({
      where: {
        appId: { in: appIds },
        ...eventsOfMarket(app.country, market),
        capturedAt: { gte: cutoff },
      },
      orderBy: { capturedAt: 'desc' },
      take: MAX_EVENTS,
      select: EVENT_SELECT,
    });

    return { events: await this.toItems(events) };
  }

  async recent(limit: number): Promise<ChangeTimeline> {
    const apps = await this.prisma.app.findMany({
      select: { id: true },
    });

    const events = await this.prisma.changeEvent.findMany({
      where: { appId: { in: apps.map((app) => app.id) }, ...HOME_EVENTS },
      orderBy: { capturedAt: 'desc' },
      take: limit,
      select: EVENT_SELECT,
    });

    return { events: await this.toItems(events) };
  }
  private async currencies(
    events: readonly EventRow[],
  ): Promise<Map<string, string | null>> {
    const priced = new Map(
      events
        .filter((event) => event.field === 'price')
        .map((event) => [listingKey(event), event] as const),
    );
    const entries = await Promise.all(
      [...priced].map(async ([key, event]) => {
        const snapshot = await this.prisma.appSnapshot.findFirst({
          where: {
            appId: event.appId,
            ...listingIn(
              event.app.country,
              listingMarket(event.app.country, event.country),
            ),
          },
          orderBy: NEWEST_FIRST,
          select: { raw: true },
        });
        return [key, snapshot ? currencyOf(snapshot.raw) : null] as const;
      }),
    );
    return new Map(entries);
  }

  private async toItems(events: EventRow[]): Promise<ChangeEventItem[]> {
    const currencies = await this.currencies(events);
    return events.map((event) => {
      const item = toChangeEventItem(event);
      return event.field === 'price'
        ? { ...item, currency: currencies.get(listingKey(event)) ?? null }
        : item;
    });
  }

  async recordMarketRefresh(
    appId: string,
    listing: { home: string; market: string; localization?: string | null },
    prev: DiffableChangeSnapshot | null,
    next: DiffableChangeSnapshot,
  ): Promise<DetectedChange[]> {
    const changes = await this.withVerifiedIcons(
      prev,
      next,
      detectChanges(prev, next),
    );
    const country = storedMarket(listing.home, listing.market);
    const localization = listing.localization ?? null;
    if (changes.length > 0) {
      await this.prisma.changeEvent.createMany({
        data: changes.map((change) => ({
          ...eventData(appId, change),
          country,
          localization,
        })),
      });
    }
    return changes;
  }

  async recordRefresh(
    appId: string,
    prev: DiffableChangeSnapshot | null,
    next: DiffableChangeSnapshot,
  ): Promise<DetectedChange[]> {
    const changes = await this.withVerifiedIcons(
      prev,
      next,
      detectChanges(prev, next),
    );
    if (changes.length > 0) {
      await this.persist(appId, changes);
    }
    return changes;
  }

  private async withVerifiedIcons(
    prev: DiffableChangeSnapshot | null,
    next: DiffableChangeSnapshot,
    changes: DetectedChange[],
  ): Promise<DetectedChange[]> {
    if (!prev || !changes.some((change) => change.field === 'icon')) {
      return changes;
    }
    const same = await this.icons.compare(prev.iconUrl, next.iconUrl);
    return same === true
      ? changes.filter((change) => change.field !== 'icon')
      : changes;
  }

  async recordCaptionChange(change: CaptionChange): Promise<void> {
    const recorded = await this.prisma.changeEvent.findFirst({
      where: {
        appId: change.appId,
        ...eventsIn(
          change.listing.home,
          change.listing.market,
          change.listing.localization,
        ),
        field: 'screenshotCaptions',
        capturedAt: change.since,
      },
      select: { id: true },
    });
    if (recorded) {
      return;
    }
    const caption: DetectedChange = {
      field: 'screenshotCaptions',
      before: joined(change.before),
      after: joined(change.after),
      detail: {
        kind: 'captions',
        added: change.added,
        removed: change.removed,
      },
    };
    const country = storedMarket(change.listing.home, change.listing.market);
    const localization = change.listing.localization;
    if (country === null && localization === null) {
      await this.persist(change.appId, [caption], change.since);
      return;
    }
    await this.prisma.changeEvent.createMany({
      data: [
        {
          ...eventData(change.appId, caption),
          country,
          localization,
          capturedAt: change.since,
        },
      ],
    });
  }

  private async persist(
    appId: string,
    changes: DetectedChange[],
    capturedAt?: Date,
  ): Promise<void> {
    await this.prisma.changeEvent.createMany({
      data: changes.map((change) => ({
        ...eventData(appId, change),
        ...(capturedAt ? { capturedAt } : {}),
      })),
    });

    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      select: { name: true, isCompetitor: true },
    });
    await this.alerts.dispatch({
      event: 'metadata.changed',
      occurredAt: new Date().toISOString(),
      app: {
        id: appId,
        name: app?.name ?? null,
        isCompetitor: app?.isCompetitor ?? false,
      },
      changes: changes.map(({ field, before, after }) => ({
        field,
        before,
        after,
      })),
    });
  }
}
