import { Store as PrismaStore } from '@prisma/client';
import { Store as SharedStore } from '@asobeast/shared';

export function toPrismaStore(shared: SharedStore): PrismaStore {
  const mapped = PrismaStore[shared];
  if (!mapped) {
    throw new Error(`Unknown store: ${shared}`);
  }
  return mapped;
}
