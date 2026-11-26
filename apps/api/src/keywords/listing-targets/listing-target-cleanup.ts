import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { serializeKeywordField } from '../keyword-field-writer';
import { readsKeywordField } from '../localization-markets';

export interface UntrackedPair {
  keywordId: string;
  text: string;
  country: string;
}

type Pair = Pick<UntrackedPair, 'text' | 'country'>;

const readIn = (pairs: readonly Pair[], text: string, localization: string) =>
  pairs.some(
    (pair) =>
      pair.text === text && readsKeywordField(pair.country, localization),
  );

export function slotsAfterUntrack(
  slots: readonly string[],
  localization: string,
  removed: readonly Pair[],
  remaining: readonly Pair[],
): string[] {
  const kept = slots.map((slot) =>
    readIn(removed, slot, localization) &&
    !readIn(remaining, slot, localization)
      ? ''
      : slot,
  );
  while (kept.at(-1) === '') {
    kept.pop();
  }
  return kept;
}

const sameSlots = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((slot, index) => slot === right[index]);

async function dropUntrackedTargets(
  tx: Prisma.TransactionClient,
  appId: string,
  removed: readonly UntrackedPair[],
): Promise<void> {
  const texts = [...new Set(removed.map(({ text }) => text))];
  const [targets, remaining] = await Promise.all([
    tx.listingTarget.findMany({
      where: { appId, slots: { hasSome: texts } },
      select: { localization: true, slots: true },
    }),
    tx.trackedKeyword.findMany({
      where: { appId, keyword: { is: { text: { in: texts } } } },
      select: { keyword: { select: { text: true, country: true } } },
    }),
  ]);
  const left = remaining.map(({ keyword }) => keyword);
  for (const { localization, slots } of targets) {
    const next = slotsAfterUntrack(slots, localization, removed, left);
    if (sameSlots(slots, next)) continue;
    const where = { appId_localization: { appId, localization } };
    await (next.length === 0
      ? tx.listingTarget.delete({ where })
      : tx.listingTarget.update({ where, data: { slots: next } }));
  }
}

export function untrackKeywords(
  prisma: PrismaService,
  appId: string,
  pairs: readonly UntrackedPair[],
): Promise<number> {
  return prisma.withTransaction(async (tx) => {
    await serializeKeywordField(tx, appId);
    const { count } = await tx.trackedKeyword.deleteMany({
      where: {
        appId,
        keywordId: { in: pairs.map(({ keywordId }) => keywordId) },
      },
    });
    if (count > 0) {
      await dropUntrackedTargets(tx, appId, pairs);
    }
    return count;
  });
}
