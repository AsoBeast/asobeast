import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeywordScope } from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { appsByStoreAppId, toDateKey } from './rankings.support';
import { detectEntrants, SerpSnapshotDay } from './serp-movers';

@Injectable()
export class RankingAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly alerts: AlertsDispatcher,
  ) {}

  async entrantBaseline(
    keywordId: string,
    date: Date,
  ): Promise<SerpSnapshotDay | null> {
    const sameDay = await this.serpDay(keywordId, date);
    if (sameDay) {
      return sameDay;
    }
    const latest = await this.prisma.serpEntry.findFirst({
      where: { keywordId, date: { lt: date } },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    return latest ? this.serpDay(keywordId, latest.date) : null;
  }

  async dispatchEntrantAlert(
    keyword: KeywordScope,
    snapshots: SerpSnapshotDay[],
  ): Promise<void> {
    const detected = detectEntrants(snapshots);
    if (detected.length === 0) {
      return;
    }

    const appByStoreAppId = await appsByStoreAppId(
      this.prisma,
      keyword.store,
      keyword.country,
      detected.map((entrant) => entrant.storeAppId),
    );

    await this.alerts.dispatch({
      event: 'serp.entrant',
      occurredAt: new Date().toISOString(),
      keyword,
      date: detected[0].date,
      entrants: detected.map((entrant) => {
        const known = appByStoreAppId.get(entrant.storeAppId);
        return {
          position: entrant.position,
          storeAppId: entrant.storeAppId,
          title: entrant.title,
          appId: known?.id ?? null,
          isCompetitor: known?.isCompetitor ?? false,
        };
      }),
    });
  }

  async dispatchRankAlert(
    app: { id: string; name: string | null },
    keyword: KeywordScope,
    date: Date,
    capture: { position: number | null; depth: number },
  ): Promise<void> {
    const { position, depth } = capture;
    const previous = await this.prisma.keywordRanking.findFirst({
      where: { appId: app.id, keywordId: keyword.id, date: { lt: date } },
      orderBy: { date: 'desc' },
      select: { position: true, depth: true },
    });
    if (!previous) {
      return;
    }

    const threshold = this.config.get('ALERT_RANK_DROP_THRESHOLD', {
      infer: true,
    });
    const from = previous.position;
    const occurredAt = new Date().toISOString();

    if (from !== null && (position === null || position - from >= threshold)) {
      await this.alerts.dispatch({
        event: 'rank.dropped',
        occurredAt,
        app,
        keyword,
        from,
        to: position,
        fromDepth: previous.depth,
        toDepth: depth,
        threshold,
      });
      return;
    }

    if (position !== null && (from === null || from - position >= threshold)) {
      await this.alerts.dispatch({
        event: 'rank.improved',
        occurredAt,
        app,
        keyword,
        from,
        to: position,
        fromDepth: previous.depth,
        toDepth: depth,
        threshold,
      });
    }
  }

  private async serpDay(
    keywordId: string,
    date: Date,
  ): Promise<SerpSnapshotDay | null> {
    const rows = await this.prisma.serpEntry.findMany({
      where: { keywordId, date },
      orderBy: { position: 'asc' },
      select: { position: true, storeAppId: true, title: true },
    });
    return rows.length > 0 ? { date: toDateKey(date), entries: rows } : null;
  }
}
