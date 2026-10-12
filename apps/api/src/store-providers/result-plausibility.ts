import { Store } from '@prisma/client';

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
