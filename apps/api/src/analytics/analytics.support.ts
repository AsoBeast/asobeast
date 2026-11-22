import { KeywordSource } from '@prisma/client';
import {
  visibility,
  VisibilityKeyword,
  VisibilityPoint,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  CheckLookup,
  currentCheckIn,
  hasBaseline,
  keywordOf,
  keywordsAtBaseline,
  keywordsNow,
} from './baseline';
import {
  addDays,
  DAY_MS,
  isSameDay,
  Metric,
  metricAt,
  positionAt,
  Ranking,
  toDateKey,
} from './days';

export {
  addDays,
  DAY_MS,
  metricAt,
  positionAt,
  rankingAt,
  startOfUtcDay,
  toDateKey,
  utcToday,
} from './days';
export type { Metric, Ranking } from './days';

const SPARKLINE_WINDOW_DAYS = 30;

export interface TrackedRow {
  keywordId: string;
  source: KeywordSource;
  relevance: number | null;
  keyword: {
    text: string;
    country: string;
    metrics: Metric[];
    rankings: Ranking[];
  };
}

interface AppGroupRef {
  id: string;
  name: string;
}

export interface KeywordWindow {
  rows: TrackedRow[];
  referenceDate: Date | null;
}

export interface GroupMember extends KeywordWindow {
  appId: string;
  group: AppGroupRef | null;
}

export interface GroupAggregate extends AppGroupRef {
  memberAppIds: string[];
  members: KeywordWindow[];
}

export const keywordsAt = (
  rows: TrackedRow[],
  date: Date,
): VisibilityKeyword[] =>
  rows.map((row) => ({
    traffic: metricAt(row.keyword.metrics, date)?.traffic ?? null,
    position: positionAt(row.keyword.rankings, date),
  }));

export const capturedOn = (rows: TrackedRow[], date: Date): boolean =>
  rows.some((row) =>
    row.keyword.rankings.some((ranking) => isSameDay(ranking.date, date)),
  );

export const visibilityAt = (rows: TrackedRow[], date: Date): number =>
  visibility(keywordsAt(rows, date));

export function delta(
  rows: TrackedRow[],
  referenceDate: Date,
  current: number,
  days: number,
): number | null {
  const past = addDays(referenceDate, -days);
  if (!hasBaseline(rows, past)) {
    return null;
  }
  return (
    Math.round((current - visibility(keywordsAtBaseline(rows, past))) * 10) / 10
  );
}

export function windowVisibility(
  rows: TrackedRow[],
  referenceDate: Date | null,
): { current: number; delta7d: number | null } {
  if (!referenceDate) {
    return { current: 0, delta7d: null };
  }
  const current = visibility(keywordsNow(rows, referenceDate));
  return { current, delta7d: delta(rows, referenceDate, current, 7) };
}

const lookupOf = (row: TrackedRow): CheckLookup => {
  const byDay = new Map(
    row.keyword.rankings.map((ranking) => [ranking.date.getTime(), ranking]),
  );
  return (date) => byDay.get(date.getTime()) ?? null;
};

export function visibilityPoints(
  rows: TrackedRow[],
  reference: Date | null,
): VisibilityPoint[] {
  const lookups = rows.map(lookupOf);
  const dates = new Set<number>();
  for (const row of rows) {
    for (const ranking of row.keyword.rankings) {
      dates.add(ranking.date.getTime());
    }
  }
  const current = reference?.getTime();
  return [...dates]
    .sort((a, b) => a - b)
    .map((time) => {
      const date = new Date(time);
      const keywords = rows.map((row, index) => {
        const lookup = lookups[index];
        const check =
          time === current ? currentCheckIn(lookup, date) : lookup(date);
        return keywordOf(row, check, date);
      });
      return { date: toDateKey(date), visibility: visibility(keywords) };
    });
}

interface ReferencedWindow extends KeywordWindow {
  referenceDate: Date;
}

const isReferenced = (member: KeywordWindow): member is ReferencedWindow =>
  member.referenceDate !== null;

const groupKeywordsAt = (
  members: KeywordWindow[],
  offsetDays: number,
): VisibilityKeyword[] =>
  members
    .filter(isReferenced)
    .flatMap((member) =>
      keywordsAt(member.rows, addDays(member.referenceDate, offsetDays)),
    );

const groupKeywordsNow = (members: KeywordWindow[]): VisibilityKeyword[] =>
  members
    .filter(isReferenced)
    .flatMap((member) => keywordsNow(member.rows, member.referenceDate));

function groupDelta(members: KeywordWindow[], days: number): number | null {
  const startOf = (member: ReferencedWindow) =>
    addDays(member.referenceDate, -days);
  const comparable = members
    .filter(isReferenced)
    .filter((member) => hasBaseline(member.rows, startOf(member)));
  if (comparable.length === 0) {
    return null;
  }
  const current = visibility(groupKeywordsNow(comparable));
  const past = visibility(
    comparable.flatMap((member) =>
      keywordsAtBaseline(member.rows, startOf(member)),
    ),
  );
  return Math.round((current - past) * 10) / 10;
}

export function groupVisibility(members: KeywordWindow[]): {
  current: number;
  delta7d: number | null;
} {
  return {
    current: visibility(groupKeywordsNow(members)),
    delta7d: groupDelta(members, 7),
  };
}

export function groupVisibilityPoints(
  members: KeywordWindow[],
): VisibilityPoint[] {
  const referenceDates = members.flatMap((member) =>
    member.referenceDate ? [member.referenceDate] : [],
  );
  if (referenceDates.length === 0) {
    return [];
  }
  const latestReference = new Date(
    Math.max(...referenceDates.map((date) => date.getTime())),
  );
  const offsets = new Set<number>();
  for (const member of members) {
    if (!member.referenceDate) {
      continue;
    }
    for (const row of member.rows) {
      for (const ranking of row.keyword.rankings) {
        offsets.add(
          (ranking.date.getTime() - member.referenceDate.getTime()) / DAY_MS,
        );
      }
    }
  }
  return [...offsets]
    .sort((a, b) => a - b)
    .map((offsetDays) => {
      const captured = members.filter(
        (member) =>
          member.referenceDate !== null &&
          capturedOn(member.rows, addDays(member.referenceDate, offsetDays)),
      );
      return {
        date: toDateKey(addDays(latestReference, offsetDays)),
        visibility: visibility(
          offsetDays === 0
            ? groupKeywordsNow(captured)
            : groupKeywordsAt(captured, offsetDays),
        ),
      };
    });
}

export function groupAggregates(members: GroupMember[]): GroupAggregate[] {
  const byGroup = new Map<string, GroupAggregate>();

  for (const member of members) {
    if (!member.group) {
      continue;
    }
    const window: KeywordWindow = {
      rows: member.rows,
      referenceDate: member.referenceDate,
    };
    const aggregate = byGroup.get(member.group.id);
    if (!aggregate) {
      byGroup.set(member.group.id, {
        id: member.group.id,
        name: member.group.name,
        memberAppIds: [member.appId],
        members: [window],
      });
      continue;
    }
    aggregate.memberAppIds.push(member.appId);
    aggregate.members.push(window);
  }

  return [...byGroup.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface TrackedScope {
  appId: string;
  country?: string;
}

const inMarket = (country?: string) =>
  country ? { keyword: { country } } : {};

export async function referenceDate(
  prisma: PrismaService,
  { appId, country }: TrackedScope,
): Promise<Date | null> {
  const latest = await prisma.keywordRanking.findFirst({
    where: { appId, ...inMarket(country) },
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  return latest?.date ?? null;
}

export async function trackedRows(
  prisma: PrismaService,
  { appId, country }: TrackedScope,
  windowStart: Date | null,
  window: Date | null,
  metricRows?: number,
): Promise<TrackedRow[]> {
  return prisma.trackedKeyword.findMany({
    where: { appId, active: true, ...inMarket(country) },
    orderBy: { createdAt: 'asc' },
    select: {
      keywordId: true,
      source: true,
      relevance: true,
      keyword: {
        select: {
          text: true,
          country: true,
          metrics: {
            where: window ? { date: { lte: window } } : undefined,
            orderBy: { date: 'desc' },
            take: metricRows,
            select: {
              traffic: true,
              difficulty: true,
              date: true,
              formulaVersion: true,
            },
          },
          rankings: {
            where: {
              appId,
              ...(windowStart && window
                ? { date: { gte: windowStart, lte: window } }
                : {}),
            },
            orderBy: { date: 'desc' },
            select: { position: true, date: true, depth: true },
          },
        },
      },
    },
  });
}

export const rankingsSince = (rows: TrackedRow[], from: Date): TrackedRow[] =>
  rows.map((row) => ({
    ...row,
    keyword: {
      ...row.keyword,
      rankings: row.keyword.rankings.filter(
        (ranking) => ranking.date.getTime() >= from.getTime(),
      ),
    },
  }));

export async function keywordWindow(
  prisma: PrismaService,
  scope: TrackedScope,
  days: number,
  metricRows?: number,
): Promise<KeywordWindow> {
  const reference = await referenceDate(prisma, scope);
  const windowStart = reference ? addDays(reference, -days) : null;
  return {
    rows: await trackedRows(prisma, scope, windowStart, reference, metricRows),
    referenceDate: reference,
  };
}

export function sparklineRows(
  prisma: PrismaService,
  appId: string,
): Promise<KeywordWindow> {
  return keywordWindow(prisma, { appId }, SPARKLINE_WINDOW_DAYS);
}
