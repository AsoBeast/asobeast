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
    const fresh = {
      keywordId: { in: [...keywordIds] },
      date: {
        gte: new Date(`${addUtcDays(today, -CHECK_FRESH_DAYS)}T00:00:00.000Z`),
      },
    };
    const [captured, placed] = await Promise.all([
      this.prisma.serpEntry.findMany({
        where: { ...fresh, position: 1 },
        select: { keywordId: true, date: true },
      }),
      this.prisma.serpEntry.findMany({
        where: { ...fresh, storeAppId },
        select: { keywordId: true, date: true, position: true },
      }),
    ]);
    const byKeyword = new Map<string, KeywordCaptures>();
    for (const { keywordId, date } of captured) {
      capturesOf(byKeyword, keywordId).days.push(utcDayOf(date));
    }
    for (const { keywordId, date, position } of placed) {
      const { positions } = capturesOf(byKeyword, keywordId);
      const day = utcDayOf(date);
      positions.set(day, Math.min(positions.get(day) ?? position, position));
    }
    for (const [keywordId, { days, positions }] of byKeyword) {
      const reading = captureReading(days, positions);
      if (reading) readings.set(keywordId, reading);
    }
    return readings;
  }
}
