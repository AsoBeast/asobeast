import { Injectable, Logger } from '@nestjs/common';
import type { App, Prisma } from '@prisma/client';
import type { ActionRule, ActionStatus, AlertPayload } from '@asobeast/shared';
import { identityOf, withAppIdentity } from '../alerts/alert-app-identities';
import { AlertOutbox } from '../alerts/alert-outbox';
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

async function wasListedIn(
  tx: Prisma.TransactionClient,
  app: App,
  market: string,
): Promise<boolean> {
  const listing = await tx.appSnapshot.findFirst({
    where: { appId: app.id, ...listingIn(app.country, market) },
    select: { id: true },
  });
  return listing !== null;
}

function keywordsIn(
  tx: Prisma.TransactionClient,
  app: App,
  market: string,
): Promise<number> {
  return tx.trackedKeyword.count({
    where: {
      appId: app.primaryAppId ?? app.id,
      active: true,
      keyword: { is: { country: market } },
    },
  });
}

@Injectable()
export class ListingAlerts {
  private readonly logger = new Logger(ListingAlerts.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsDispatcher,
    private readonly outbox: AlertOutbox,
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

  recordLoss(
    tx: Prisma.TransactionClient,
    app: App,
    market: string,
    lostAt: Date,
  ): Promise<void> {
    return this.outbox.record(
      tx,
      `the listing loss of app ${app.id} in ${market}`,
      () => this.lossOf(tx, app, market, lostAt),
    );
  }

  private async lossOf(
    tx: Prisma.TransactionClient,
    app: App,
    market: string,
    lostAt: Date,
  ): Promise<AlertPayload | null> {
    if (market === app.country) {
      return withAppIdentity(delistedPayload(app, lostAt), identityOf(app));
    }
    if (!(await wasListedIn(tx, app, market))) return null;
    return withAppIdentity(
      unlistedMarketPayload(
        app,
        market,
        await keywordsIn(tx, app, market),
        lostAt,
      ),
      identityOf(app),
    );
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
