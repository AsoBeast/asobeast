import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  type KeywordBreakdown,
  keywordFieldLocalizations,
} from '@asobeast/shared';
import {
  eventsOfMarket,
  HOME_LISTING,
  listingIn,
  NEWEST_FIRST,
} from '../apps/listing';
import {
  LISTING_TEXT_SELECT,
  latestLocalizedTexts,
  type LocalizedTexts,
} from '../apps/listing-texts';
import { shippedLocalizations } from '../apps/shipped-localizations';
import { fieldPhrases } from '../metadata/listing-surfaces';
import { PrismaService } from '../prisma/prisma.service';
import { keywordWords } from './keyword-breakdown-fields';
import {
  recentChange,
  standingOf,
  withInsights,
} from './keyword-breakdown-insights';
import {
  breakdownApp,
  type BreakdownListing,
  type BreakdownSubject,
  sortBreakdown,
} from './keyword-breakdown-subject';
import { ensurePrimaryApp } from './keywords.support';

const COMPETITOR_REFUSAL =
  'A competitor app has no keyword breakdown; use its primary app';

const LISTING_CHANGE_FIELDS = ['title', 'subtitle', 'summary', 'description'];

interface BreakdownApp {
  id: string;
  name: string | null;
  iconUrl: string | null;
  country: string;
}

interface SavedField {
  localization: string;
  phrases: string[];
  updatedAt: Date;
}

@Injectable()
export class KeywordBreakdownService {
  constructor(private readonly prisma: PrismaService) {}

  async breakdown(appId: string, keywordId: string): Promise<KeywordBreakdown> {
    const app = await ensurePrimaryApp(this.prisma, appId, COMPETITOR_REFUSAL);
    const tracked = await this.prisma.trackedKeyword.findUnique({
      where: { appId_keywordId: { appId, keywordId } },
      select: { keyword: { select: { text: true, country: true } } },
    });
    if (!tracked) {
      throw new NotFoundException(`Keyword ${keywordId} is not tracked`);
    }
    const { text, country: market } = tracked.keyword;
    const words = keywordWords(text);
    const apps = await this.prisma.app.findMany({
      where: { OR: [{ id: appId }, { primaryAppId: appId }] },
      select: { id: true, name: true, iconUrl: true, country: true },
      orderBy: { createdAt: 'asc' },
    });
    const [rankings, subjects, fields, shipped, listingChange] =
      await Promise.all([
        this.rankings(keywordId, apps),
        Promise.all(apps.map((each) => this.subject(each, app.store, market))),
        this.savedFields(appId),
        shippedLocalizations(this.prisma, app),
        this.listingChange(appId, app.country, market),
      ]);
    const context = {
      store: app.store,
      market,
      home: app.country,
      keyword: text,
      words,
    };
    const breakdowns = sortBreakdown(
      subjects.map((subject) => {
        const isYou = subject.id === appId;
        return breakdownApp(
          {
            ...subject,
            isYou,
            fields: isYou ? fieldPhrases(fields) : new Map(),
            shipped: isYou ? shipped : [],
            ranking: rankings.get(subject.id) ?? null,
          },
          context,
        );
      }),
    );
    const withNotes = withInsights(breakdowns, {
      store: app.store,
      market,
      words,
    });
    const fieldChange = newestFieldSave(fields, market);
    return {
      keywordId,
      text,
      store: app.store,
      country: market,
      words,
      standing: standingOf(
        withNotes,
        words,
        recentChange(
          { listing: listingChange, keywordField: fieldChange },
          new Date(),
        ),
      ),
      apps: withNotes,
    };
  }

  private async rankings(
    keywordId: string,
    apps: readonly BreakdownApp[],
  ): Promise<Map<string, NonNullable<BreakdownSubject['ranking']>>> {
    const rows = await this.prisma.keywordRanking.findMany({
      where: { keywordId, appId: { in: apps.map((each) => each.id) } },
      orderBy: { date: 'desc' },
      distinct: ['appId'],
      select: { appId: true, position: true, depth: true, date: true },
    });
    return new Map(
      rows.map(({ appId, position, depth, date }) => [
        appId,
        { position, depth, date },
      ]),
    );
  }

  private async subject(
    app: BreakdownApp,
    store: Store,
    market: string,
  ): Promise<
    Omit<BreakdownSubject, 'isYou' | 'fields' | 'shipped' | 'ranking'>
  > {
    const [listing, localized] = await Promise.all([
      this.listing(app, market),
      store === Store.APP_STORE
        ? latestLocalizedTexts(this.prisma, app.id, app.country, [market]).then(
            (texts): LocalizedTexts[] => texts.get(market) ?? [],
          )
        : [],
    ]);
    return {
      id: app.id,
      name: app.name,
      iconUrl: app.iconUrl,
      listing,
      localized,
    };
  }

  private async listing(
    app: BreakdownApp,
    market: string,
  ): Promise<BreakdownListing | null> {
    const select = {
      ...LISTING_TEXT_SELECT,
      ratingAvg: true,
      ratingCount: true,
      capturedAt: true,
    };
    const inMarket = await this.prisma.appSnapshot.findFirst({
      where: { appId: app.id, ...listingIn(app.country, market) },
      orderBy: NEWEST_FIRST,
      select,
    });
    if (inMarket) return toListing(inMarket, market);
    if (market === app.country) return null;
    const home = await this.prisma.appSnapshot.findFirst({
      where: { appId: app.id, ...HOME_LISTING },
      orderBy: NEWEST_FIRST,
      select,
    });
    return home ? toListing(home, app.country) : null;
  }

  private async savedFields(appId: string): Promise<SavedField[]> {
    const rows = await this.prisma.keywordField.findMany({
      where: { appId },
      select: { localization: true, phrases: true, updatedAt: true },
    });
    return rows.filter((row) => row.phrases.length > 0);
  }

  private async listingChange(
    appId: string,
    home: string,
    market: string,
  ): Promise<Date | null> {
    const event = await this.prisma.changeEvent.findFirst({
      where: {
        appId,
        ...eventsOfMarket(home, market),
        field: { in: LISTING_CHANGE_FIELDS },
      },
      orderBy: { capturedAt: 'desc' },
      select: { capturedAt: true },
    });
    return event?.capturedAt ?? null;
  }
}

function toListing(
  row: {
    capturedAt: Date;
    ratingAvg: number | null;
    ratingCount: number | null;
  } & BreakdownListing['texts'],
  country: string,
): BreakdownListing {
  const { capturedAt, ratingAvg, ratingCount, ...texts } = row;
  return { texts, country, capturedAt, ratingAvg, ratingCount };
}

function newestFieldSave(
  fields: readonly SavedField[],
  market: string,
): Date | null {
  const read = new Set<string>(keywordFieldLocalizations(market));
  return fields
    .filter((field) => read.has(field.localization))
    .reduce<Date | null>(
      (newest, field) =>
        newest === null || field.updatedAt > newest ? field.updatedAt : newest,
      null,
    );
}
