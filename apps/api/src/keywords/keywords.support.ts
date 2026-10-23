import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  countChars,
  KeywordImportReason,
  normalizeText,
  TRACKED_KEYWORD_CHAR_LIMIT,
} from '@asobeast/shared';
import { QUEUES, queueNameForStore } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';

const MAX_KEYWORD_WORDS = 5;
const RANKING_HISTORY_LIMIT = 60;

export interface KeywordApp {
  id: string;
  workspaceId: string;
  store: Store;
  country: string;
  storeAppId: string;
}

type KeywordTextReason = Extract<
  KeywordImportReason,
  'empty' | 'tooLong' | 'tooManyWords'
>;

export type KeywordTextCheck =
  | { ok: true; text: string }
  | { ok: false; reason: KeywordTextReason; message: string };

export function checkKeywordText(raw: string): KeywordTextCheck {
  const text = normalizeText(raw);
  if (!text) {
    return { ok: false, reason: 'empty', message: 'Keyword must not be empty' };
  }
  if (countChars(text) > TRACKED_KEYWORD_CHAR_LIMIT) {
    return {
      ok: false,
      reason: 'tooLong',
      message: `Keyword exceeds ${TRACKED_KEYWORD_CHAR_LIMIT} characters`,
    };
  }
  if (text.split(' ').length > MAX_KEYWORD_WORDS) {
    return {
      ok: false,
      reason: 'tooManyWords',
      message: `Keyword "${text}" exceeds ${MAX_KEYWORD_WORDS} words`,
    };
  }
  return { ok: true, text };
}

export function normalizeKeyword(raw: string): string {
  const check = checkKeywordText(raw);
  if (!check.ok) {
    throw new BadRequestException(check.message);
  }
  return check.text;
}

const KEYWORD_APP_SELECT = {
  id: true,
  workspaceId: true,
  store: true,
  country: true,
  storeAppId: true,
} as const;

export async function ensureApp(
  prisma: PrismaService,
  appId: string,
): Promise<KeywordApp> {
  const app = await prisma.app.findFirst({
    where: { id: appId },
    select: KEYWORD_APP_SELECT,
  });
  if (!app) {
    throw new NotFoundException(`App ${appId} not found`);
  }
  return app;
}

export async function ensurePrimaryApp(
  prisma: PrismaService,
  appId: string,
  refusal: string,
): Promise<KeywordApp> {
  const app = await prisma.app.findFirst({
    where: { id: appId },
    select: { ...KEYWORD_APP_SELECT, isCompetitor: true },
  });
  if (!app) {
    throw new NotFoundException(`App ${appId} not found`);
  }
  if (app.isCompetitor) {
    throw new BadRequestException(refusal);
  }
  return app;
}

function requireAppStore(app: KeywordApp): KeywordApp {
  if (app.store !== Store.APP_STORE) {
    throw new BadRequestException(
      'The keyword field is only available for App Store apps',
    );
  }
  return app;
}

export async function ensureKeywordFieldApp(
  prisma: PrismaService,
  appId: string,
): Promise<KeywordApp> {
  return requireAppStore(await ensureApp(prisma, appId));
}

export async function ensureLocalizedFieldApp(
  prisma: PrismaService,
  appId: string,
): Promise<KeywordApp> {
  return requireAppStore(
    await ensurePrimaryApp(
      prisma,
      appId,
      'A competitor app has no localizations or keyword fields; use its primary app',
    ),
  );
}

export async function trackedTexts(
  prisma: PrismaService,
  appId: string,
  country?: string,
): Promise<Set<string>> {
  const rows = await prisma.trackedKeyword.findMany({
    where: { appId, ...(country ? { keyword: { country } } : {}) },
    select: { keyword: { select: { text: true } } },
  });
  return new Set(rows.map((row) => row.keyword.text));
}

export function queueFor(
  store: Store,
  appStoreQueue: Queue,
  gplayQueue: Queue,
): Queue {
  return queueNameForStore(store) === QUEUES.GPLAY ? gplayQueue : appStoreQueue;
}

export function trackedOrder() {
  return [{ createdAt: 'asc' as const }, { keywordId: 'asc' as const }];
}

export function trackedArgs(appId: string) {
  return {
    orderBy: trackedOrder(),
    select: {
      keywordId: true,
      source: true,
      active: true,
      relevance: true,
      tags: true,
      note: true,
      keyword: {
        select: {
          text: true,
          country: true,
          store: true,
          rankings: {
            where: { appId },
            orderBy: { date: 'desc' as const },
            take: RANKING_HISTORY_LIMIT,
            select: { position: true, date: true, depth: true },
          },
          metrics: {
            orderBy: { date: 'desc' as const },
            take: 1,
            select: {
              traffic: true,
              difficulty: true,
              date: true,
              scoringSource: true,
              formulaVersion: true,
              confidence: true,
              capturedAt: true,
              stats: true,
            },
          },
        },
      },
    },
  };
}
