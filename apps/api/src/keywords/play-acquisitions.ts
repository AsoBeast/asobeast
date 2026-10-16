import { normalizeText, type PlayAcquisitions } from '@asobeast/shared';
import { toDateKey } from '../analytics/analytics.support';
import type { PrismaService } from '../prisma/prisma.service';
import { reportingRequest } from '../store-connect/store-funnel.service';

export interface SearchTermMonth {
  month: Date;
  normalized: string;
  visitors: number;
  acquisitions: number;
}

export function newestAcquisitions(
  rows: SearchTermMonth[],
  currentMonth?: string,
): Map<string, PlayAcquisitions> {
  const complete = rows.filter((row) => toDateKey(row.month) !== currentMonth);
  const byTerm = newestOf(complete);
  for (const [term, acquisitions] of newestOf(rows)) {
    if (!byTerm.has(term)) byTerm.set(term, acquisitions);
  }
  return byTerm;
}

function newestOf(rows: SearchTermMonth[]): Map<string, PlayAcquisitions> {
  const byTerm = new Map<string, PlayAcquisitions>();
  for (const row of rows) {
    const month = toDateKey(row.month);
    const known = byTerm.get(row.normalized);
    if (known?.month === month) {
      known.visitors += row.visitors;
      known.acquisitions += row.acquisitions;
    } else if (!known || known.month < month) {
      byTerm.set(row.normalized, {
        month,
        visitors: row.visitors,
        acquisitions: row.acquisitions,
      });
    }
  }
  return byTerm;
}

const startOfUtcMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

export async function playAcquisitions(
  prisma: PrismaService,
  appId: string,
  texts: string[],
  now = new Date(),
): Promise<Map<string, PlayAcquisitions>> {
  const normalized = [...new Set(texts.map(normalizeText))];
  if (normalized.length === 0) return new Map();
  const reporting = await prisma.storeReportRequest.findFirst({
    where: reportingRequest([appId], 'GOOGLE_PLAY'),
    select: { id: true },
  });
  if (!reporting) return new Map();
  const rows = await prisma.storeFunnelSearchTerm.findMany({
    where: { appId, normalized: { in: normalized } },
    select: {
      month: true,
      normalized: true,
      visitors: true,
      acquisitions: true,
    },
  });
  return newestAcquisitions(rows, toDateKey(startOfUtcMonth(now)));
}
