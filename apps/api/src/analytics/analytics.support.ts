import { KeywordSource } from '@prisma/client';
import { VisibilityPoint } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { visibility, VisibilityKeyword } from './visibility';

export const DAY_MS = 24 * 60 * 60 * 1000;
const SPARKLINE_WINDOW_DAYS = 30;

export interface Metric {
  traffic: number | null;
  difficulty: number | null;
  date: Date;
}

export interface Ranking {
  position: number | null;
  date: Date;
  depth: number;
}

export interface TrackedRow {
  keywordId: string;
  source: KeywordSource;
  relevance: number | null;
  keyword: {
    text: string;
    metrics: Metric[];
    rankings: Ranking[];
  };
}

interface AppGroupRef {
  id: string;
  name: string;
}

export interface GroupMemberWindow {
  rows: TrackedRow[];
  referenceDate: Date | null;
}

export interface GroupMember extends GroupMemberWindow {
  appId: string;
  group: AppGroupRef | null;
}

export interface GroupAggregate extends AppGroupRef {
  memberAppIds: string[];
  members: GroupMemberWindow[];
}

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_MS);

export const startOfUtcDay = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

export const utcToday = (): Date => startOfUtcDay(new Date());

export const toDateKey = (date: Date): string =>
  date.toISOString().slice(0, 10);

const isSameDay = (a: Date, b: Date): boolean => a.getTime() === b.getTime();

export const positionAt = (rankings: Ranking[], date: Date): number | null =>
  rankings.find((ranking) => isSameDay(ranking.date, date))?.position ?? null;

export const metricAt = (metrics: Metric[], date: Date): Metric | null =>
  metrics.find((metric) => metric.date.getTime() <= date.getTime()) ?? null;

const keywordsAt = (rows: TrackedRow[], date: Date): VisibilityKeyword[] =>
  rows.map((row) => ({
    traffic: metricAt(row.keyword.metrics, date)?.traffic ?? null,
    position: positionAt(row.keyword.rankings, date),
  }));

const capturedOn = (rows: TrackedRow[], date: Date): boolean =>
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
  if (!capturedOn(rows, past)) {
    return null;
  }
  return Math.round((current - visibilityAt(rows, past)) * 10) / 10;
}

export function windowVisibility(
  rows: TrackedRow[],
  referenceDate: Date | null,
): { current: number; delta7d: number | null } {
  if (!referenceDate) {
    return { current: 0, delta7d: null };
  }
  const current = visibilityAt(rows, referenceDate);
  return { current, delta7d: delta(rows, referenceDate, current, 7) };
}

export function visibilityPoints(rows: TrackedRow[]): VisibilityPoint[] {
  const dates = new Set<number>();
  for (const row of rows) {
    for (const ranking of row.keyword.rankings) {
      dates.add(ranking.date.getTime());
    }
  }
  return [...dates]
    .sort((a, b) => a - b)
    .map((time) => {
      const date = new Date(time);
      return { date: toDateKey(date), visibility: visibilityAt(rows, date) };
    });
}

const groupKeywordsAt = (
  members: GroupMemberWindow[],
  offsetDays: number,
): VisibilityKeyword[] =>
  members.flatMap((member) => {
    if (!member.referenceDate) {
      return [];
    }
    return keywordsAt(member.rows, addDays(member.referenceDate, offsetDays));
  });

function groupDelta(members: GroupMemberWindow[], days: number): number | null {
  const comparable = members.filter(
    (member) =>
      member.referenceDate !== null &&
      capturedOn(member.rows, addDays(member.referenceDate, -days)),
  );
  if (comparable.length === 0) {
    return null;
  }
  const current = visibility(groupKeywordsAt(comparable, 0));
  const past = visibility(groupKeywordsAt(comparable, -days));
  return Math.round((current - past) * 10) / 10;
}

export function groupVisibility(members: GroupMemberWindow[]): {
  current: number;
  delta7d: number | null;
} {
  return {
    current: visibility(groupKeywordsAt(members, 0)),
    delta7d: groupDelta(members, 7),
  };
}

export function groupVisibilityPoints(
  members: GroupMemberWindow[],
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
        visibility: visibility(groupKeywordsAt(captured, offsetDays)),
      };
    });
}

export function groupAggregates(members: GroupMember[]): GroupAggregate[] {
  const byGroup = new Map<string, GroupAggregate>();

  for (const member of members) {
    if (!member.group) {
      continue;
    }
    const window: GroupMemberWindow = {
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

export async function referenceDate(
  prisma: PrismaService,
  appId: string,
): Promise<Date | null> {
  const latest = await prisma.keywordRanking.findFirst({
    where: { appId },
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  return latest?.date ?? null;
}

export async function trackedRows(
  prisma: PrismaService,
  appId: string,
  windowStart: Date | null,
  window: Date | null,
): Promise<TrackedRow[]> {
  return prisma.trackedKeyword.findMany({
    where: { appId, active: true },
    orderBy: { createdAt: 'asc' },
    select: {
      keywordId: true,
      source: true,
      relevance: true,
      keyword: {
        select: {
          text: true,
          metrics: {
            where: window ? { date: { lte: window } } : undefined,
            orderBy: { date: 'desc' },
            select: { traffic: true, difficulty: true, date: true },
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

export async function sparklineRows(
  prisma: PrismaService,
  appId: string,
): Promise<{ rows: TrackedRow[]; referenceDate: Date | null }> {
  const reference = await referenceDate(prisma, appId);
  const windowStart = reference
    ? addDays(reference, -SPARKLINE_WINDOW_DAYS)
    : null;
  return {
    rows: await trackedRows(prisma, appId, windowStart, reference),
    referenceDate: reference,
  };
}
