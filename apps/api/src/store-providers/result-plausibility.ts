import type { Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { ImplausibleResultError } from './errors';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const IMPLAUSIBLE_LOOKBACK_DAYS = 7;

export const EMPTY_ANSWER_RETRIES: Record<Store, number> = {
  APP_STORE: 3,
  GOOGLE_PLAY: 0,
};

export const EMPTY_ANSWER_RETRY_DELAY_MS = 4000;

export function isImplausiblyEmpty(input: {
  resultCount: number;
  lastSeenOn: Date | null;
  today: Date;
}): boolean {
  if (input.resultCount > 0 || !input.lastSeenOn) return false;
  const age = input.today.getTime() - input.lastSeenOn.getTime();
  return age > 0 && age <= IMPLAUSIBLE_LOOKBACK_DAYS * DAY_MS;
}

export async function askAgainWhileEmpty<T>(
  ask: () => Promise<T[]>,
  retries: number,
  first?: T[],
): Promise<T[]> {
  let results = first ?? (await ask());
  for (let retry = 0; results.length === 0 && retry < retries; retry++) {
    await new Promise((resolve) =>
      setTimeout(resolve, EMPTY_ANSWER_RETRY_DELAY_MS),
    );
    results = await ask();
  }
  return results;
}

interface LastAttempt<T> {
  finalAttempt: boolean;
  logger: Logger;
  next: string;
  settled: T;
}

export function settleOnLastAttempt<T>(
  empty: ImplausibleResultError,
  { finalAttempt, logger, next, settled }: LastAttempt<T>,
): T {
  if (!finalAttempt || !empty.retryable) throw empty;
  logger.warn(
    `last attempt: ${empty.message}, so nothing changes until the next ${next}`,
  );
  return settled;
}
