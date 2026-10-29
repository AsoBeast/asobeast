import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeywordScope } from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { EarlierRankings } from './earlier-rankings';
import {
  ConfirmationWindow,
  confirmedDrop,
  confirmedExit,
  undoesDrop,
  undoesExit,
} from './rank-confirmation';
import {
  CompetitorCapture,
  overtaken,
  positionAlert,
  RankCapture,
} from './rank-milestones';
import { appsByStoreAppId, toDateKey } from './rankings.support';
import { detectEntrants, SerpSnapshotDay } from './serp-movers';

interface PreviousRanking {
  date: Date;
  position: number | null;
  depth: number;
}

export interface MilestoneCheck {
  app: { id: string; name: string | null };
  keyword: KeywordScope;
  date: Date;
  depth: number;
  capture: RankCapture;
  competitors: CompetitorCapture[];
}

interface ConfirmedContext {
  occurredAt: string;
  app: { id: string; name: string | null };
  keyword: KeywordScope;
  depth: number;
  window: ConfirmationWindow;
}

const undoingMark = (undoing: boolean): { undoesDrop?: true } =>
  undoing ? { undoesDrop: true } : {};

@Injectable()
export class RankingAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly alerts: AlertsDispatcher,
    private readonly earlier: EarlierRankings,
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
    const previous = await this.previousRanking(app.id, keyword.id, date);
    if (!previous) {
      return;
    }

    const threshold = this.dropThreshold();
    const window = await this.windowFor(app.id, keyword.id, previous, position);
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
    } else if (
      position !== null &&
      (from === null || from - position >= threshold)
    ) {
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
        ...undoingMark(undoesDrop(window)),
      });
    }
    await this.dispatchConfirmedDrop({
      occurredAt,
      app,
      keyword,
      depth,
      window,
    });
  }

  async dispatchMilestoneAlerts(check: MilestoneCheck): Promise<void> {
    const competitors = check.competitors.filter(
      (competitor) => check.capture.changed || competitor.changed,
    );
    if (!check.capture.changed && competitors.length === 0) {
      return;
    }
    const previous = await this.previousRanking(
      check.app.id,
      check.keyword.id,
      check.date,
    );
    if (!previous) {
      return;
    }
    const occurredAt = new Date().toISOString();
    if (check.capture.changed) {
      await this.dispatchPositionAlert(check, previous, occurredAt);
    }
    await this.dispatchOvertakes(check, previous, competitors, occurredAt);
  }

  private async dispatchPositionAlert(
    check: MilestoneCheck,
    previous: PreviousRanking,
    occurredAt: string,
  ): Promise<void> {
    const { app, keyword, date, depth } = check;
    const to = check.capture.position;
    const rankedEarlier =
      previous.position === null &&
      to !== null &&
      (await this.rankedEarlier(app.id, keyword.id, date));
    const window = await this.windowFor(app.id, keyword.id, previous, to);
    const alert = positionAlert(previous.position, to, rankedEarlier);
    if (alert?.event === 'rank.first') {
      await this.alerts.dispatch({
        event: 'rank.first',
        occurredAt,
        app,
        keyword,
        position: alert.position,
        depth,
      });
    } else if (alert?.event === 'rank.milestone') {
      await this.alerts.dispatch({
        event: 'rank.milestone',
        occurredAt,
        app,
        keyword,
        tier: alert.milestone.tier,
        direction: alert.milestone.direction,
        from: previous.position,
        to,
        fromDepth: previous.depth,
        toDepth: depth,
        ...undoingMark(
          alert.milestone.direction === 'entered' &&
            undoesExit(window, alert.milestone.tier),
        ),
      });
    }
    await this.dispatchConfirmedExit({
      occurredAt,
      app,
      keyword,
      depth,
      window,
    });
  }

  private dropThreshold(): number {
    return this.config.get('ALERT_RANK_DROP_THRESHOLD', { infer: true });
  }

  private async windowFor(
    appId: string,
    keywordId: string,
    previous: PreviousRanking,
    today: number | null,
  ): Promise<ConfirmationWindow> {
    const older = await this.earlier.before(appId, keywordId, previous.date);
    return {
      checks: [previous, ...older],
      today,
      threshold: this.dropThreshold(),
    };
  }

  private async dispatchConfirmedDrop(
    context: ConfirmedContext,
  ): Promise<void> {
    const confirmed = confirmedDrop(context.window);
    if (!confirmed) return;
    await this.alerts.dispatch({
      event: 'rank.dropped',
      occurredAt: context.occurredAt,
      app: context.app,
      keyword: context.keyword,
      from: confirmed.from,
      to: context.window.today,
      fromDepth: confirmed.fromDepth,
      toDepth: context.depth,
      threshold: context.window.threshold,
      confirmed: true,
    });
  }

  private async dispatchConfirmedExit(
    context: ConfirmedContext,
  ): Promise<void> {
    const confirmed = confirmedExit(context.window);
    if (!confirmed) return;
    await this.alerts.dispatch({
      event: 'rank.milestone',
      occurredAt: context.occurredAt,
      app: context.app,
      keyword: context.keyword,
      tier: confirmed.tier,
      direction: 'left',
      from: confirmed.from,
      to: context.window.today,
      fromDepth: confirmed.fromDepth,
      toDepth: context.depth,
      confirmed: true,
    });
  }

  private async dispatchOvertakes(
    check: MilestoneCheck,
    previous: PreviousRanking,
    competitors: CompetitorCapture[],
    occurredAt: string,
  ): Promise<void> {
    const from = previous.position;
    const ranked = competitors.flatMap((competitor) =>
      competitor.position === null
        ? []
        : [{ ...competitor, position: competitor.position }],
    );
    if (from === null || ranked.length === 0) {
      return;
    }
    const rows = await this.prisma.keywordRanking.findMany({
      where: {
        keywordId: check.keyword.id,
        date: previous.date,
        appId: { in: ranked.map((competitor) => competitor.id) },
      },
      select: { appId: true, position: true },
    });
    const before = new Map(rows.map((row) => [row.appId, row.position]));
    for (const competitor of ranked) {
      const competitorFrom = before.get(competitor.id);
      if (competitorFrom === undefined) continue;
      const passed = overtaken(
        { app: from, competitor: competitorFrom },
        { app: check.capture.position, competitor: competitor.position },
      );
      if (!passed) continue;
      await this.alerts.dispatch({
        event: 'rank.overtaken',
        occurredAt,
        app: check.app,
        keyword: check.keyword,
        competitor: {
          id: competitor.id,
          name: competitor.name,
          from: competitorFrom,
          to: competitor.position,
        },
        from,
        to: check.capture.position,
        fromDepth: previous.depth,
        toDepth: check.depth,
      });
    }
  }

  private previousRanking(
    appId: string,
    keywordId: string,
    date: Date,
  ): Promise<PreviousRanking | null> {
    return this.prisma.keywordRanking.findFirst({
      where: { appId, keywordId, date: { lt: date } },
      orderBy: { date: 'desc' },
      select: { date: true, position: true, depth: true },
    });
  }

  private async rankedEarlier(
    appId: string,
    keywordId: string,
    date: Date,
  ): Promise<boolean> {
    const earlier = await this.prisma.keywordRanking.findFirst({
      where: { appId, keywordId, date: { lt: date }, position: { not: null } },
      select: { date: true },
    });
    return earlier !== null;
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
