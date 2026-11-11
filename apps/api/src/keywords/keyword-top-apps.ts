import {
  CHECK_FRESH_DAYS,
  KEYWORD_TOP_APPS,
  KeywordTopApp,
  KeywordTopAppRole,
  utcDayOf,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface TopAppRow {
  keywordId: string;
  date: Date;
  position: number;
  storeAppId: string;
  title: string;
  iconUrl: string | null;
}

export interface TopAppRoles {
  own: string;
  competitors: ReadonlySet<string>;
}

function freshFrom(today: string): Date {
  const from = new Date(`${today}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - CHECK_FRESH_DAYS);
  return from;
}

export function loadTopAppRows(
  prisma: PrismaService,
  keywordIds: string[],
  today: string,
): Promise<TopAppRow[]> {
  if (keywordIds.length === 0) {
    return Promise.resolve([]);
  }
  return prisma.serpEntry.findMany({
    where: {
      keywordId: { in: keywordIds },
      position: { lte: KEYWORD_TOP_APPS },
      date: { gte: freshFrom(today) },
    },
    orderBy: [{ date: 'desc' }, { position: 'asc' }],
    select: {
      keywordId: true,
      date: true,
      position: true,
      storeAppId: true,
      title: true,
      iconUrl: true,
    },
  });
}

function roleOf(storeAppId: string, roles: TopAppRoles): KeywordTopAppRole {
  if (storeAppId === roles.own) return 'own';
  return roles.competitors.has(storeAppId) ? 'competitor' : 'other';
}

export function topAppsByKeyword(
  rows: readonly TopAppRow[],
  roles: TopAppRoles,
): Map<string, KeywordTopApp[]> {
  const newestDay = new Map<string, string>();
  const apps = new Map<string, KeywordTopApp[]>();
  for (const row of rows) {
    const day = utcDayOf(row.date);
    const newest = newestDay.get(row.keywordId);
    if (newest === undefined || day > newest) {
      newestDay.set(row.keywordId, day);
      apps.set(row.keywordId, []);
    } else if (day < newest) {
      continue;
    }
    apps.get(row.keywordId)?.push({
      storeAppId: row.storeAppId,
      title: row.title,
      iconUrl: row.iconUrl,
      position: row.position,
      role: roleOf(row.storeAppId, roles),
    });
  }
  for (const list of apps.values()) {
    list.sort((a, b) => a.position - b.position);
  }
  return apps;
}
