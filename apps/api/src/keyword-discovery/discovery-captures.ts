import { Injectable } from '@nestjs/common';
import {
  addUtcDays,
  CHECK_FRESH_DAYS,
  DISCOVERY_CAPTURE_DEPTH,
  utcDayOf,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface CaptureReading {
  position: number | null;
  depth: number;
  checkedOn: string;
}

interface KeywordCaptures {
  days: string[];
  positions: Map<string, number>;
}

const utcDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

const withinCapture = (position: number | undefined): position is number =>
  position !== undefined &&
  position >= 1 &&
  position <= DISCOVERY_CAPTURE_DEPTH;

export function captureReading(
  captureDays: readonly string[],
  appPositions: ReadonlyMap<string, number>,
): CaptureReading | null {
  const newest = [...captureDays].sort().at(-1);
  if (newest === undefined) return null;
  const position = appPositions.get(newest);
  return {
    position: withinCapture(position) ? position : null,
    depth: DISCOVERY_CAPTURE_DEPTH,
    checkedOn: newest,
  };
}

export const captureResolves = (reading: CaptureReading): boolean =>
  reading.position !== null;

const capturesOf = (
  byKeyword: Map<string, KeywordCaptures>,
  keywordId: string,
): KeywordCaptures => {
  const known = byKeyword.get(keywordId);
  if (known) return known;
  const created = { days: [], positions: new Map<string, number>() };
  byKeyword.set(keywordId, created);
  return created;
};

@Injectable()
export class DiscoveryCaptures {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    storeAppId: string,
    keywordIds: readonly string[],
    today: string,
  ): Promise<Map<string, CaptureReading>> {
    const readings = new Map<string, CaptureReading>();
    if (keywordIds.length === 0) return readings;
    const rows = await this.prisma.serpEntry.findMany({
      where: {
        keywordId: { in: [...keywordIds] },
        date: {
          gte: utcDate(addUtcDays(today, -CHECK_FRESH_DAYS)),
          lte: utcDate(today),
        },
        OR: [{ position: 1 }, { storeAppId }],
      },
      select: { keywordId: true, date: true, position: true, storeAppId: true },
    });
    const byKeyword = new Map<string, KeywordCaptures>();
    for (const row of rows) {
      const { days, positions } = capturesOf(byKeyword, row.keywordId);
      const day = utcDayOf(row.date);
      if (row.position === 1) days.push(day);
      if (row.storeAppId === storeAppId) {
        positions.set(
          day,
          Math.min(positions.get(day) ?? row.position, row.position),
        );
      }
    }
    for (const [keywordId, { days, positions }] of byKeyword) {
      const reading = captureReading(days, positions);
      if (reading) readings.set(keywordId, reading);
    }
    return readings;
  }
}
