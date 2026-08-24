import { Injectable, NotFoundException } from '@nestjs/common';
import { ChangeField, ChangeTimeline } from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { PrismaService } from '../prisma/prisma.service';
import {
  DetectedChange,
  DiffableChangeSnapshot,
  detectChanges,
} from './change-detector';

const MAX_EVENTS = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const EVENT_SELECT = {
  id: true,
  appId: true,
  field: true,
  before: true,
  after: true,
  capturedAt: true,
  app: { select: { name: true, isCompetitor: true } },
} as const;

interface EventRow {
  id: string;
  appId: string;
  field: string;
  before: string | null;
  after: string | null;
  capturedAt: Date;
  app: { name: string | null; isCompetitor: boolean };
}

const toChangeEventItem = (event: EventRow) => ({
  id: event.id,
  appId: event.appId,
  appName: event.app.name,
  isCompetitor: event.app.isCompetitor,
  field: event.field as ChangeField,
  before: event.before,
  after: event.after,
  capturedAt: event.capturedAt.toISOString(),
});

@Injectable()
export class ChangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsDispatcher,
  ) {}

  async timeline(appId: string, days: number): Promise<ChangeTimeline> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, competitors: { select: { id: true } } },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const appIds = [
      app.id,
      ...app.competitors.map((competitor) => competitor.id),
    ];
    const cutoff = new Date(Date.now() - days * DAY_MS);

    const events = await this.prisma.changeEvent.findMany({
      where: { appId: { in: appIds }, capturedAt: { gte: cutoff } },
      orderBy: { capturedAt: 'desc' },
      take: MAX_EVENTS,
      select: EVENT_SELECT,
    });

    return { events: events.map(toChangeEventItem) };
  }

  async recent(limit: number): Promise<ChangeTimeline> {
    const apps = await this.prisma.app.findMany({
      select: { id: true },
    });

    const events = await this.prisma.changeEvent.findMany({
      where: { appId: { in: apps.map((app) => app.id) } },
      orderBy: { capturedAt: 'desc' },
      take: limit,
      select: EVENT_SELECT,
    });

    return { events: events.map(toChangeEventItem) };
  }

  async recordRefresh(
    appId: string,
    prev: DiffableChangeSnapshot | null,
    next: DiffableChangeSnapshot,
  ): Promise<DetectedChange[]> {
    const changes = detectChanges(prev, next);
    if (changes.length === 0) {
      return changes;
    }

    await this.prisma.changeEvent.createMany({
      data: changes.map((change) => ({ appId, ...change })),
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
      changes,
    });

    return changes;
  }
}
