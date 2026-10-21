import { request as httpRequest } from 'node:http';
import type { PrismaClient } from '@prisma/client';

export type Answer = number | 'cut';

export interface TableLock {
  release: () => Promise<void>;
}

export interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

const ANSWER_TIMEOUT_MS = 20_000;

export function deferred(): Deferred {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

export async function lockUserTable(prisma: PrismaClient): Promise<TableLock> {
  const released = deferred();
  const acquired = deferred();
  const holding = prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`LOCK TABLE "User" IN ACCESS EXCLUSIVE MODE`;
      acquired.resolve();
      await released.promise;
    },
    { timeout: 60_000 },
  );
  await Promise.race([acquired.promise, holding]);
  return {
    release: async () => {
      released.resolve();
      await holding;
    },
  };
}

export function answerOf(port: number, path: string): Promise<Answer> {
  return new Promise((resolve) => {
    const sent = httpRequest(
      { port, path, timeout: ANSWER_TIMEOUT_MS },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    sent.on('timeout', () => sent.destroy());
    sent.on('error', () => resolve('cut'));
    sent.end();
  });
}

export const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function pendingAfter<T>(
  work: Promise<T>,
  ms: number,
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const waited = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), ms);
  });
  return Promise.race([work.then(() => false), waited]).finally(() =>
    clearTimeout(timer),
  );
}
