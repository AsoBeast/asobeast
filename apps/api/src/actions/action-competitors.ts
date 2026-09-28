import {
  ChangeField,
  isChangeField,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { ActionRankingDay } from './action-context';
import { REGRESSION_INDEXED_FIELDS } from './rules/rank-investigate-drop';

export const COMPETITOR_CHANGE_WINDOW_DAYS = 14;
export const COMPETITOR_RANKING_WINDOW_DAYS = 21;

export interface ActionCompetitor {
  id: string;
  name: string | null;
}

export interface ActionCompetitorChange {
  competitorAppId: string;
  competitorName: string | null;
  field: ChangeField;
  after: string | null;
  capturedAt: Date;
}

interface CompetitorChangeRow {
  appId: string;
  field: string;
  after: string | null;
  capturedAt: Date;
  app: { name: string | null };
}

interface CompetitorRankingRow {
  appId: string;
  keywordId: string;
  date: Date;
  position: number | null;
}

export interface CompetitorRows {
  changes: CompetitorChangeRow[];
  rankings: CompetitorRankingRow[];
}

export const competitorRankingKey = (
  competitorAppId: string,
  keywordId: string,
): string => `${competitorAppId}~${keywordId}`;

const daysBefore = (now: Date, days: number): Date =>
  new Date(now.getTime() - days * 86_400_000);

interface LiveApp {
  app: { id: string; country: string; competitors: ActionCompetitor[] };
  tracked: TrackedKeywordItem[];
}

export function homeKeywordIds(
  live: LiveApp[],
): Map<string, ReadonlySet<string>> {
  return new Map(
    live.map(({ app, tracked }) => [
      app.id,
      new Set(
        tracked
          .filter(
            (keyword) => keyword.active && keyword.country === app.country,
          )
          .map((keyword) => keyword.keywordId),
      ),
    ]),
  );
}

export async function loadCompetitorRows(
  prisma: PrismaService,
  live: LiveApp[],
  homeIds: Map<string, ReadonlySet<string>>,
  now: Date,
): Promise<CompetitorRows> {
  const competitorIds = live.flatMap(({ app }) =>
    app.competitors.map(({ id }) => id),
  );
  const keywordIds = [
    ...new Set([...homeIds.values()].flatMap((ids) => [...ids])),
  ];
  if (competitorIds.length === 0) return { changes: [], rankings: [] };
  const [changes, rankings] = await Promise.all([
    prisma.changeEvent.findMany({
      where: {
        appId: { in: competitorIds },
        field: { in: [...REGRESSION_INDEXED_FIELDS] },
        capturedAt: { gte: daysBefore(now, COMPETITOR_CHANGE_WINDOW_DAYS) },
      },
      select: {
        appId: true,
        field: true,
        after: true,
        capturedAt: true,
        app: { select: { name: true } },
      },
      orderBy: { capturedAt: 'asc' },
    }),
    keywordIds.length === 0
      ? Promise.resolve([])
      : prisma.keywordRanking.findMany({
          where: {
            appId: { in: competitorIds },
            keywordId: { in: keywordIds },
            date: { gte: daysBefore(now, COMPETITOR_RANKING_WINDOW_DAYS) },
          },
          select: { appId: true, keywordId: true, date: true, position: true },
          orderBy: { date: 'asc' },
        }),
  ]);
  return { changes, rankings };
}

function competitorChangesFor(
  competitors: ActionCompetitor[],
  rows: CompetitorRows,
): ActionCompetitorChange[] {
  const ids = new Set(competitors.map((competitor) => competitor.id));
  return rows.changes.flatMap((row) =>
    ids.has(row.appId) && isChangeField(row.field)
      ? [
          {
            competitorAppId: row.appId,
            competitorName: row.app.name,
            field: row.field,
            after: row.after,
            capturedAt: row.capturedAt,
          },
        ]
      : [],
  );
}

function competitorRankingDaysFor(
  competitors: ActionCompetitor[],
  keywordIds: ReadonlySet<string>,
  rows: CompetitorRows,
): Map<string, ActionRankingDay[]> {
  const ids = new Set(competitors.map((competitor) => competitor.id));
  const days = new Map<string, ActionRankingDay[]>();
  for (const row of rows.rankings) {
    if (!ids.has(row.appId) || !keywordIds.has(row.keywordId)) continue;
    const key = competitorRankingKey(row.appId, row.keywordId);
    const day = {
      date: row.date.toISOString().slice(0, 10),
      position: row.position,
    };
    const bucket = days.get(key);
    if (bucket) bucket.push(day);
    else days.set(key, [day]);
  }
  return days;
}

export function competitorContext(
  competitors: ActionCompetitor[],
  keywordIds: ReadonlySet<string>,
  rows: CompetitorRows,
): {
  competitors: ActionCompetitor[];
  competitorChanges: ActionCompetitorChange[];
  competitorRankingDays: Map<string, ActionRankingDay[]>;
} {
  return {
    competitors: competitors.map(({ id, name }) => ({ id, name })),
    competitorChanges: competitorChangesFor(competitors, rows),
    competitorRankingDays: competitorRankingDaysFor(
      competitors,
      keywordIds,
      rows,
    ),
  };
}
