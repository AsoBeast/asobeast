import { Injectable, NotFoundException } from '@nestjs/common';
import { SerpMovers, SerpSnapshot } from '@asobeast/shared';
import { TrackedKeywordAccess } from '../keywords/tracked-keyword.access';
import { PrismaService } from '../prisma/prisma.service';
import { SerpMoversQueryDto } from './dto/serp-movers-query.dto';
import { SerpQueryDto } from './dto/serp-query.dto';
import {
  appsByStoreAppId,
  DAY_MS,
  toDateKey,
  utcToday,
} from './rankings.support';
import { detectEntrants, SerpSnapshotDay } from './serp-movers';

const MOVERS_LIMIT = 50;

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

    const date = query.date
      ? new Date(`${query.date}T00:00:00.000Z`)
      : ((
          await this.prisma.serpEntry.findFirst({
            where: { keywordId },
            orderBy: { date: 'desc' },
            select: { date: true },
          })
        )?.date ?? null);

    if (!date) {
      return { keywordId, text: keyword.text, date: null, entries: [] };
    }

    const entries = await this.prisma.serpEntry.findMany({
      where: { keywordId, date },
      orderBy: { position: 'asc' },
      select: {
        position: true,
        storeAppId: true,
        title: true,
        developer: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    const byStoreAppId = await appsByStoreAppId(
      this.prisma,
      keyword.store,
      keyword.country,
      entries.map((entry) => entry.storeAppId),
    );

    return {
      keywordId,
      text: keyword.text,
      date: toDateKey(date),
      entries: entries.map((entry) => {
        const app = byStoreAppId.get(entry.storeAppId);
        return {
          position: entry.position,
          storeAppId: entry.storeAppId,
          title: entry.title,
          developer: entry.developer,
          ratingAvg: entry.ratingAvg,
          ratingCount: entry.ratingCount,
          appId: app?.id ?? null,
          isCompetitor: app?.isCompetitor ?? false,
        };
      }),
    };
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
      where: { keywordId: { in: keywordIds }, date: { gte: from } },
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
