import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { normalizeText } from '@asobeast/shared';
import { QUEUES, queueNameForStore } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';

const MAX_KEYWORD_WORDS = 5;
const MAX_KEYWORD_CHARS = 100;
const RANKING_HISTORY_LIMIT = 60;

export interface KeywordApp {
  id: string;
  workspaceId: string;
  store: Store;
  country: string;
  storeAppId: string;
}

export function normalizeKeyword(raw: string): string {
  const text = normalizeText(raw);
  if (!text) {
    throw new BadRequestException('Keyword must not be empty');
  }
  if (text.length > MAX_KEYWORD_CHARS) {
    throw new BadRequestException(
      `Keyword exceeds ${MAX_KEYWORD_CHARS} characters`,
    );
  }
  if (text.split(' ').length > MAX_KEYWORD_WORDS) {
    throw new BadRequestException(
      `Keyword "${text}" exceeds ${MAX_KEYWORD_WORDS} words`,
    );
  }
  return text;
}

export async function ensureApp(
  prisma: PrismaService,
  appId: string,
): Promise<KeywordApp> {
  const app = await prisma.app.findFirst({
    where: { id: appId },
    select: {
      id: true,
      workspaceId: true,
      store: true,
      country: true,
      storeAppId: true,
    },
  });
  if (!app) {
    throw new NotFoundException(`App ${appId} not found`);
  }
  return app;
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

export function trackedArgs(appId: string) {
  return {
    orderBy: { createdAt: 'asc' as const },
    select: {
      keywordId: true,
      source: true,
      active: true,
      relevance: true,
      keyword: {
        select: {
          text: true,
          country: true,
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
            },
          },
        },
      },
    },
  };
}
