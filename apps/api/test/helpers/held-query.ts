import { request as httpRequest } from 'node:http';
import type { PrismaClient } from '@prisma/client';

export type Answer = number | 'cut';

export interface TableLock {
  release: () => Promise<void>;
}

export async function lockUserTable(prisma: PrismaClient): Promise<TableLock> {
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let locked = (): void => undefined;
  const acquired = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const holding = prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`LOCK TABLE "User" IN ACCESS EXCLUSIVE MODE`;
      locked();
      await released;
    },
    { timeout: 60_000 },
  );
  await acquired;
  return {
    release: async () => {
      release();
      await holding;
    },
  };
}

export function answerOf(port: number, path: string): Promise<Answer> {
  return new Promise((resolve) => {
    const sent = httpRequest({ port, path }, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    sent.on('error', () => resolve('cut'));
    sent.end();
  });
}

export const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const pendingAfter = async <T>(
  work: Promise<T>,
  ms: number,
): Promise<boolean> =>
  Promise.race([work.then(() => false), elapse(ms).then(() => true)]);
