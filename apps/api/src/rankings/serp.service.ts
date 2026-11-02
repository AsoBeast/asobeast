import { Injectable, NotFoundException } from '@nestjs/common';
import {
  SerpEntryItem,
  SerpExitItem,
  SerpMovers,
  SerpSnapshot,
} from '@asobeast/shared';
import {
  AuthorizedKeyword,
  TrackedKeywordAccess,
} from '../keywords/tracked-keyword.access';
import { PrismaService } from '../prisma/prisma.service';
import { SerpMoversQueryDto } from './dto/serp-movers-query.dto';
import { SerpQueryDto } from './dto/serp-query.dto';
import {
  appsByStoreAppId,
  DAY_MS,
  toDateKey,
  utcToday,
} from './rankings.support';
import { serpExits, serpMovement } from './serp-history';
import { detectEntrants, SerpSnapshotDay } from './serp-movers';
import { titleJudge } from './serp-title-match';
import { TOP_TEN_ROWS } from './top-ten';

type SerpRole = Pick<SerpEntryItem, 'appId' | 'isCompetitor'>;

const MOVERS_LIMIT = 50;
const SERP_DATE_LIMIT = 365;

const utcDay = (date: string) => new Date(`${date}T00:00:00.000Z`);

interface SerpEntrant {
  date: string;
  keywordId: string;
  position: number;
  storeAppId: string;
  title: string;
}

@Injectable()
export class SerpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackedKeywords: TrackedKeywordAccess,
  ) {}

  async serp(keywordId: string, query: SerpQueryDto): Promise<SerpSnapshot> {
    const keyword = await this.trackedKeywords.require(keywordId);
    const dates = await this.capturedDates(keywordId);
    const shown = query.date ?? dates[0] ?? null;
    if (shown === null) {
      return {
        keywordId,
        text: keyword.text,
        date: null,
        entries: [],
        comparedTo: null,
        exits: [],
        dates,
      };
    }

    const { rows, comparedTo, earlier } = await this.comparedDays(
      keywordId,
      shown,
    );
    const entries = serpMovement(rows, earlier);
    const exits = serpExits(rows, earlier);
    const roleOf = await this.rolesOf(keyword, [...rows, ...exits]);
    const judgeTitle = titleJudge(keyword.text);

    return {
      keywordId,
      text: keyword.text,
      date: shown,
      entries: entries.map((entry): SerpEntryItem => ({
        position: entry.position,
        storeAppId: entry.storeAppId,
        title: entry.title,
        developer: entry.developer,
        ratingAvg: entry.ratingAvg,
        ratingCount: entry.ratingCount,
        ...roleOf(entry.storeAppId),
        iconUrl: entry.iconUrl,
        ...judgeTitle(entry.title),
        previous: entry.previous,
        delta: entry.delta,
        movement: entry.movement,
      })),
      comparedTo,
      exits: exits.map((exit): SerpExitItem => ({
        previous: exit.previous,
        storeAppId: exit.storeAppId,
        title: exit.title,
        developer: exit.developer,
        iconUrl: exit.iconUrl,
        ...roleOf(exit.storeAppId),
      })),
      dates,
    };
  }

  private async comparedDays(keywordId: string, shown: string) {
    const [rows, previousDay] = await Promise.all([
      this.serpDay(keywordId, shown),
      this.capturedDayBefore(keywordId, shown),
    ]);
    const comparedTo = rows.length > 0 ? previousDay : null;
    const earlier = comparedTo
      ? await this.serpDay(keywordId, comparedTo)
      : null;
    return { rows, comparedTo, earlier };
  }

  private async rolesOf(
    keyword: AuthorizedKeyword,
    rows: { storeAppId: string }[],
  ): Promise<(storeAppId: string) => SerpRole> {
    const known = await appsByStoreAppId(
      this.prisma,
      keyword.store,
      keyword.country,
      [...new Set(rows.map((row) => row.storeAppId))],
    );
    return (storeAppId) => {
      const app = known.get(storeAppId);
      return {
        appId: app?.id ?? null,
        isCompetitor: app?.isCompetitor ?? false,
      };
    };
  }

  private async capturedDates(keywordId: string): Promise<string[]> {
    const days = await this.prisma.serpEntry.findMany({
      where: { keywordId, position: 1 },
      orderBy: { date: 'desc' },
      take: SERP_DATE_LIMIT,
      select: { date: true },
    });
    return days.map((day) => toDateKey(day.date));
  }

  private async capturedDayBefore(
    keywordId: string,
    date: string,
  ): Promise<string | null> {
    const day = await this.prisma.serpEntry.findFirst({
      where: { keywordId, position: 1, date: { lt: utcDay(date) } },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    return day ? toDateKey(day.date) : null;
  }

  private serpDay(keywordId: string, date: string) {
    return this.prisma.serpEntry.findMany({
      where: { keywordId, date: utcDay(date) },
      orderBy: { position: 'asc' },
      select: {
        position: true,
        storeAppId: true,
        title: true,
        developer: true,
        iconUrl: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });
  }

  async serpMovers(
    appId: string,
    query: SerpMoversQueryDto,
  ): Promise<SerpMovers> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, store: true, country: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const tracked = await this.prisma.trackedKeyword.findMany({
      where: { appId, active: true },
      select: { keywordId: true, keyword: { select: { text: true } } },
    });
    const textByKeyword = new Map(
      tracked.map((row) => [row.keywordId, row.keyword.text]),
    );
    if (textByKeyword.size === 0) {
      return { windowDays: query.days, items: [] };
    }

    const movers = await this.entrantsInWindow(
      [...textByKeyword.keys()],
      query.days,
    );

    const byStoreAppId = await appsByStoreAppId(
      this.prisma,
      app.store,
      app.country,
      movers.map((mover) => mover.storeAppId),
    );

    const items = movers
      .map((mover) => {
        const known = byStoreAppId.get(mover.storeAppId);
        return {
          date: mover.date,
          keywordId: mover.keywordId,
          text: textByKeyword.get(mover.keywordId) ?? '',
          position: mover.position,
          storeAppId: mover.storeAppId,
          title: mover.title,
          appId: known?.id ?? null,
          isCompetitor: known?.isCompetitor ?? false,
        };
      })
      .sort((a, b) =>
        a.date === b.date
          ? a.position - b.position
          : b.date.localeCompare(a.date),
      )
      .slice(0, MOVERS_LIMIT);

    return { windowDays: query.days, items };
  }

  private async entrantsInWindow(
    keywordIds: string[],
    days: number,
  ): Promise<SerpEntrant[]> {
    const from = new Date(utcToday().getTime() - days * DAY_MS);
    const rows = await this.prisma.serpEntry.findMany({
      where: {
        keywordId: { in: keywordIds },
        date: { gte: from },
        ...TOP_TEN_ROWS,
      },
      select: {
        keywordId: true,
        date: true,
        position: true,
        storeAppId: true,
        title: true,
      },
    });

    const snapshotsByKeyword = new Map<string, Map<string, SerpSnapshotDay>>();
    for (const row of rows) {
      const dateKey = toDateKey(row.date);
      let dayMap = snapshotsByKeyword.get(row.keywordId);
      if (!dayMap) {
        dayMap = new Map();
        snapshotsByKeyword.set(row.keywordId, dayMap);
      }
      let snapshot = dayMap.get(dateKey);
      if (!snapshot) {
        snapshot = { date: dateKey, entries: [] };
        dayMap.set(dateKey, snapshot);
      }
      snapshot.entries.push({
        position: row.position,
        storeAppId: row.storeAppId,
        title: row.title,
      });
    }

    const movers: SerpEntrant[] = [];
    for (const [keywordId, byDay] of snapshotsByKeyword) {
      for (const entrant of detectEntrants([...byDay.values()])) {
        movers.push({ keywordId, ...entrant });
      }
    }
    return movers;
  }
}
