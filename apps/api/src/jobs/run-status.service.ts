import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  STORES,
  type Store,
  type StoreRunStatus,
  type WorkspaceRunStatus,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { previousDailyRun } from './daily-schedule';
import { runStateOf } from './run-state';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

interface CaptureRow {
  store: Store;
  captured: number;
  lastCaptureAt: Date | null;
}

interface TrackedRow {
  store: Store;
  tracked: number;
}

@Injectable()
export class RunStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async forWorkspace(now = new Date()): Promise<WorkspaceRunStatus> {
    const trigger =
      previousDailyRun(this.config.get('CRON_DAILY', { infer: true }), now) ??
      new Date(now.getTime() - DAY_MS);

    const [tracking, captures] = await Promise.all([
      this.tracked(),
      this.captures(trigger),
    ]);

    const stores: StoreRunStatus[] = STORES.map((store) => ({
      store,
      tracked: tracking.find((row) => row.store === store)?.tracked ?? 0,
      captured: captures.find((row) => row.store === store)?.captured ?? 0,
    })).filter((status) => status.tracked > 0 || status.captured > 0);

    const tracked = sum(stores, (store) => store.tracked);
    const captured = sum(stores, (store) => store.captured);

    return {
      state: runStateOf({
        tracked,
        captured,
        hoursSinceTrigger: (now.getTime() - trigger.getTime()) / HOUR_MS,
      }),
      startedAt: trigger.toISOString(),
      lastCaptureAt: latestCapture(captures),
      tracked,
      captured,
      stores,
    };
  }

  private tracked(): Promise<TrackedRow[]> {
    return this.prisma.$queryRaw<TrackedRow[]>`
      SELECT k."store", COUNT(DISTINCT t."keywordId")::int AS tracked
      FROM "TrackedKeyword" t
      JOIN "Keyword" k ON k."id" = t."keywordId"
      WHERE t."active" = true
      GROUP BY 1
    `;
  }

  private captures(trigger: Date): Promise<CaptureRow[]> {
    return this.prisma.$queryRaw<CaptureRow[]>`
      SELECT k."store",
             COUNT(DISTINCT r."keywordId")::int AS captured,
             MAX(r."createdAt") AS "lastCaptureAt"
      FROM "KeywordRanking" r
      JOIN "Keyword" k ON k."id" = r."keywordId"
      WHERE r."createdAt" >= ${trigger}
      GROUP BY 1
    `;
  }
}

function sum<T>(rows: T[], select: (row: T) => number): number {
  return rows.reduce((total, row) => total + select(row), 0);
}

function latestCapture(rows: CaptureRow[]): string | null {
  const times = rows
    .map((row) => row.lastCaptureAt)
    .filter((value): value is Date => value !== null)
    .map((value) => value.getTime());
  return times.length === 0 ? null : new Date(Math.max(...times)).toISOString();
}
