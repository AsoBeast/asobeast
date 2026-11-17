import { Injectable } from '@nestjs/common';
import type { App, Prisma } from '@prisma/client';
import type {
  ActionRule,
  ActionStatus,
  AlertPayload,
  Store,
} from '@asobeast/shared';
import { identityOf, withAppIdentity } from '../alerts/alert-app-identities';
import { AlertOutbox } from '../alerts/alert-outbox';
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

export interface RatedListingApp extends ListingAlertApp {
  store: Store;
  iconUrl: string | null;
}

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

function ratedHistory(
  tx: Prisma.TransactionClient,
  appId: string,
  capturedAt: Date,
) {
  return tx.appSnapshot.findMany({
    where: {
      appId,
      ...HOME_LISTING,
      capturedAt: {
        gte: new Date(capturedAt.getTime() - RATING_DROP_HISTORY_DAYS * DAY_MS),
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
  constructor(private readonly outbox: AlertOutbox) {}

  recordRatingDrop(
    tx: Prisma.TransactionClient,
    app: RatedListingApp,
    capturedAt: Date,
  ): Promise<void> {
    return this.outbox.record(tx, `the rating drop of app ${app.id}`, () =>
      this.dropOf(tx, app, capturedAt),
    );
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

  private async dropOf(
    tx: Prisma.TransactionClient,
    app: RatedListingApp,
    capturedAt: Date,
  ): Promise<AlertPayload | null> {
    const drop = newRatingDrop(await ratedHistory(tx, app.id, capturedAt));
    if (!drop) return null;
    const action = await tx.actionItem.findFirst({
      where: { appId: app.id, rule: RATING_DECLINE_RULE, status: OPEN_ACTION },
      select: { id: true },
    });
    return withAppIdentity(
      ratingDroppedPayload(app, drop, action?.id ?? null, capturedAt),
      identityOf(app),
    );
  }
}
