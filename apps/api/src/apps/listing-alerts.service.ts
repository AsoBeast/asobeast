import { Injectable, Logger } from '@nestjs/common';
import type { App } from '@prisma/client';
import type { ActionRule, ActionStatus } from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { PrismaService } from '../prisma/prisma.service';
import {
  delistedPayload,
  ratingDroppedPayload,
  unlistedMarketPayload,
  type ListingAlertApp,
} from './listing-alert-payloads';
import { HOME_LISTING, listingIn, NEWEST_FIRST } from './listing';
import { newRatingDrop, RATING_DROP_HISTORY_DAYS } from './rating-drop';

const DAY_MS = 86_400_000;
const RATING_DECLINE_RULE: ActionRule = 'reviews.investigate_rating_decline';
const OPEN_ACTION: ActionStatus = 'OPEN';

@Injectable()
export class ListingAlerts {
  private readonly logger = new Logger(ListingAlerts.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsDispatcher,
  ) {}

  async ratingDropped(app: ListingAlertApp, capturedAt: Date): Promise<void> {
    try {
      await this.raiseRatingDrop(app, capturedAt);
    } catch (error: unknown) {
      this.logger.warn(
        `rating drop alert for app ${app.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async listingLost(app: App, market: string, lostAt: Date): Promise<void> {
    try {
      await this.raiseListingLoss(app, market, lostAt);
    } catch (error: unknown) {
      this.logger.warn(
        `listing loss alert for app ${app.id} in ${market} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async raiseListingLoss(
    app: App,
    market: string,
    now: Date,
  ): Promise<void> {
    if (market === app.country) {
      await this.alerts.dispatch(delistedPayload(app, now));
      return;
    }
    if (!(await this.wasListedIn(app, market))) return;
    await this.alerts.dispatch(
      unlistedMarketPayload(
        app,
        market,
        await this.keywordsIn(app, market),
        now,
      ),
    );
  }

  private async wasListedIn(app: App, market: string): Promise<boolean> {
    const listing = await this.prisma.appSnapshot.findFirst({
      where: { appId: app.id, ...listingIn(app.country, market) },
      select: { id: true },
    });
    return listing !== null;
  }

  private keywordsIn(app: App, market: string): Promise<number> {
    return this.prisma.trackedKeyword.count({
      where: {
        appId: app.primaryAppId ?? app.id,
        active: true,
        keyword: { is: { country: market } },
      },
    });
  }

  private async raiseRatingDrop(
    app: ListingAlertApp,
    capturedAt: Date,
  ): Promise<void> {
    const history = await this.prisma.appSnapshot.findMany({
      where: {
        appId: app.id,
        ...HOME_LISTING,
        capturedAt: {
          gte: new Date(
            capturedAt.getTime() - RATING_DROP_HISTORY_DAYS * DAY_MS,
          ),
          lte: capturedAt,
        },
      },
      orderBy: NEWEST_FIRST,
      select: {
        capturedAt: true,
        ratingAvg: true,
        ratingCount: true,
        version: true,
      },
    });
    const drop = newRatingDrop(history);
    if (!drop) return;
    const action = await this.prisma.actionItem.findFirst({
      where: { appId: app.id, rule: RATING_DECLINE_RULE, status: OPEN_ACTION },
      select: { id: true },
    });
    await this.alerts.dispatch(
      ratingDroppedPayload(app, drop, action?.id ?? null, capturedAt),
    );
  }
}
