import { PrismaService } from '../prisma/prisma.service';
import { pairKey } from './keyword-import';
import { TrackingLookup, TrackingState } from './keyword-import-plan';
import { KeywordPair } from './keyword-tracker';
import { KeywordApp } from './keywords.support';

export async function loadTrackingStates(
  prisma: PrismaService,
  app: Pick<KeywordApp, 'id' | 'store'>,
  pairs: readonly KeywordPair[],
): Promise<TrackingLookup> {
  if (pairs.length === 0) {
    return new Map();
  }
  const rows = await prisma.trackedKeyword.findMany({
    where: {
      keyword: {
        is: {
          store: app.store,
          text: { in: [...new Set(pairs.map(({ text }) => text))] },
          country: { in: [...new Set(pairs.map(({ country }) => country))] },
        },
      },
    },
    select: {
      appId: true,
      active: true,
      keyword: { select: { text: true, country: true } },
    },
  });
  const states = new Map<string, TrackingState>();
  for (const row of rows) {
    const key = pairKey(row.keyword.country, row.keyword.text);
    const state = states.get(key) ?? { own: null, elsewhere: false };
    if (row.appId === app.id) {
      state.own = row.active ? 'active' : 'paused';
    } else if (row.active) {
      state.elsewhere = true;
    }
    states.set(key, state);
  }
  return states;
}
