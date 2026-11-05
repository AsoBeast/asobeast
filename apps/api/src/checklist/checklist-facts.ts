import type { Prisma } from '@prisma/client';
import type { ChecklistAppFacts, ChecklistFacts } from '@asobeast/shared';
import { DELIVERABLE_EMAIL_ALERTS } from '../alerts/deliverable-email-alerts';
import { replyStateWhere } from '../reviews/review-list-query';

type Tx = Prisma.TransactionClient;

const OWN_APP = { app: { isCompetitor: false } } as const;

function readPrimaryApps(tx: Tx) {
  return tx.app.findMany({
    where: { isCompetitor: false },
    select: { id: true, store: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

async function readMarketsByApp(tx: Tx): Promise<Map<string, number>> {
  const rows = await tx.$queryRaw<{ appId: string; markets: number }[]>`
    SELECT t."appId", COUNT(DISTINCT k."country")::int AS markets
    FROM "TrackedKeyword" t
    JOIN "Keyword" k ON k."id" = t."keywordId"
    WHERE t."active" = true
    GROUP BY t."appId"
  `;
  return new Map(rows.map((row) => [row.appId, row.markets]));
}

async function readAppsWithCompetitors(tx: Tx): Promise<Set<string>> {
  const rows = await tx.app.findMany({
    where: { isCompetitor: true, primaryAppId: { not: null } },
    select: { primaryAppId: true },
    distinct: ['primaryAppId'],
  });
  return new Set(rows.flatMap((row) => row.primaryAppId ?? []));
}

async function readAppsWithKeywordFields(tx: Tx): Promise<Set<string>> {
  const rows = await tx.keywordField.findMany({
    where: { phrases: { isEmpty: false } },
    select: { appId: true },
    distinct: ['appId'],
  });
  return new Set(rows.map((row) => row.appId));
}

async function readAppsNeedingReply(tx: Tx): Promise<Set<string>> {
  const rows = await tx.review.findMany({
    where: {
      ...OWN_APP,
      ...replyStateWhere('needs_reply', tx.review.fields.repliedAt),
    },
    select: { appId: true },
    distinct: ['appId'],
  });
  return new Set(rows.map((row) => row.appId));
}

async function readAlertChannels(tx: Tx): Promise<number> {
  const webhooks = await tx.webhook.count({ where: { active: true } });
  const emails = await tx.emailAlert.count({
    where: DELIVERABLE_EMAIL_ALERTS,
  });
  return webhooks + emails;
}

export async function readChecklistFacts(
  tx: Tx,
  consoleAvailable: boolean,
): Promise<ChecklistFacts> {
  const primaryApps = await readPrimaryApps(tx);
  const markets = await readMarketsByApp(tx);
  const withCompetitors = await readAppsWithCompetitors(tx);
  const withKeywordFields = await readAppsWithKeywordFields(tx);
  const needingReply = await readAppsNeedingReply(tx);
  const apps: ChecklistAppFacts[] = primaryApps.map((app) => ({
    id: app.id,
    store: app.store,
    markets: markets.get(app.id) ?? 0,
    competitors: withCompetitors.has(app.id) ? 1 : 0,
    keywordFields: withKeywordFields.has(app.id) ? 1 : 0,
    reviewsNeedingReply: needingReply.has(app.id) ? 1 : 0,
  }));
  return {
    apps,
    consoleAvailable,
    consoleConnections: consoleAvailable
      ? await tx.storeConnection.count({ where: { status: 'active' } })
      : 0,
    usedTokens: await tx.apiToken.count({
      where: { lastUsedAt: { not: null } },
    }),
    alertChannels: await readAlertChannels(tx),
    reviewsStored:
      (await tx.review.findFirst({ where: OWN_APP, select: { id: true } })) !==
      null,
    replies: await tx.reviewReply.count({
      where: { ...OWN_APP, repliedAt: { not: null } },
    }),
  };
}
