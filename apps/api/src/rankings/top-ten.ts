import { Prisma } from '@prisma/client';
import { SERP_DEPTH } from '@asobeast/shared';

export const TOP_TEN_ROWS = {
  position: { lte: SERP_DEPTH },
} as const satisfies Prisma.SerpEntryWhereInput;

export const topTenOf = <T extends { position: number }>(
  entries: readonly T[],
): T[] => entries.filter((entry) => entry.position <= SERP_DEPTH);
