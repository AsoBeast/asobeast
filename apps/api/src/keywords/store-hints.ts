import { Logger } from '@nestjs/common';
import { StoreRequestError } from '../store-providers/errors';
import { storeDeadlinePassed } from '../store-providers/store-deadline';
import type { StoreProvider } from '../store-providers/types';

export interface StoreHint {
  seed: string;
  position: number;
  term: string;
  priority?: number;
}

const logger = new Logger('StoreHints');

export async function suggestAround(
  provider: Pick<StoreProvider, 'suggest'>,
  seeds: readonly string[],
  country: string,
): Promise<StoreHint[]> {
  const hints: StoreHint[] = [];
  const failures: StoreRequestError[] = [];
  let asked = 0;
  for (const seed of seeds) {
    if (storeDeadlinePassed()) break;
    asked += 1;
    try {
      const items = await provider.suggest(seed, country);
      items.forEach((item, index) =>
        hints.push({
          seed,
          position: index + 1,
          term: item.term,
          priority: item.priority,
        }),
      );
    } catch (error) {
      if (!(error instanceof StoreRequestError)) throw error;
      failures.push(error);
    }
  }
  if (asked > 0 && failures.length === asked) throw failures[0];
  if (failures.length > 0) {
    logger.warn(`${failures.length} of ${asked} store suggestions failed`);
  }
  return hints;
}
