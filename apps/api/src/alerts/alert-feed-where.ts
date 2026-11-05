import { Prisma } from '@prisma/client';
import { ALERT_FEED_DAYS, type AlertFeedEvent } from '@asobeast/shared';
import type { FeedCursor } from './alert-event-cursor';
import { CONFIRMED_KEY_PREFIXES } from './outbox-rows';

const DAY_MS = 86_400_000;

export interface FeedFilter {
  types: readonly AlertFeedEvent[];
  since: Date;
  after: Date | null;
  appIds: readonly string[] | null;
  keywordIds: readonly string[];
  cursor: FeedCursor | null;
}

export const feedWindowStart = (now: Date): Date =>
  new Date(now.getTime() - ALERT_FEED_DAYS * DAY_MS);

const notConfirmedCopy: Prisma.AlertEventWhereInput = {
  OR: [
    { dedupeKey: null },
    {
      NOT: {
        OR: CONFIRMED_KEY_PREFIXES.map((prefix) => ({
          dedupeKey: { startsWith: prefix },
        })),
      },
    },
  ],
};

const beforeCursor = (cursor: FeedCursor): Prisma.AlertEventWhereInput => ({
  OR: [
    { createdAt: { lt: cursor.createdAt } },
    { createdAt: { equals: cursor.createdAt }, id: { lt: cursor.id } },
  ],
});

const ofApps = (
  appIds: readonly string[],
  keywordIds: readonly string[],
): Prisma.AlertEventWhereInput => ({
  OR: [
    { appId: { in: [...appIds] } },
    { appId: null, keywordId: { in: [...keywordIds] } },
  ],
});

export function feedWhere(filter: FeedFilter): Prisma.AlertEventWhereInput {
  const conditions: Prisma.AlertEventWhereInput[] = [
    { event: { in: [...filter.types] } },
    { createdAt: { gte: filter.since } },
    notConfirmedCopy,
  ];
  if (filter.after) conditions.push({ createdAt: { gt: filter.after } });
  if (filter.cursor) conditions.push(beforeCursor(filter.cursor));
  if (filter.appIds) {
    conditions.push(ofApps(filter.appIds, filter.keywordIds));
  }
  return { AND: conditions };
}
