import {
  DigestWeeklyPayload,
  MetadataChangedPayload,
  RANK_DEPTH,
  RankDroppedPayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  AlertAppIdentities,
  appIdsOf,
  IdentityLookup,
  withAppIdentity,
} from './alert-app-identities';

const identity = {
  iconUrl: 'https://play-lh.googleusercontent.com/icon',
  store: 'GOOGLE_PLAY' as const,
  country: 'de',
};

const lookup: IdentityLookup = new Map([['app1', identity]]);

const drop: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-10-24T03:10:00.000Z',
  app: { id: 'app1', name: 'App One' },
  keyword: { id: 'kw1', text: 'maps', store: 'GOOGLE_PLAY', country: 'de' },
  from: 3,
  to: 12,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  threshold: 5,
};

const change: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-10-24T03:10:00.000Z',
  app: { id: 'app1', name: 'Rival', isCompetitor: true },
  changes: [{ field: 'title', before: 'Old', after: 'New' }],
};

const entrant: SerpEntrantPayload = {
  event: 'serp.entrant',
  occurredAt: '2026-10-24T03:10:00.000Z',
  keyword: drop.keyword,
  date: '2026-10-24',
  entrants: [],
};

const digest: DigestWeeklyPayload = {
  event: 'digest.weekly',
  occurredAt: '2026-10-24T03:10:00.000Z',
  window: { from: '2026-10-17', to: '2026-10-24' },
  apps: [],
  groups: [],
};

describe('appIdsOf', () => {
  it('names the app of an event that has one', () => {
    expect(appIdsOf(drop)).toEqual(['app1']);
  });

  it('names nothing for an event without an app', () => {
    expect(appIdsOf(entrant)).toEqual([]);
    expect(appIdsOf(digest)).toEqual([]);
  });
});

describe('withAppIdentity', () => {
  it('adds the icon, store and storefront to a rank payload', () => {
    expect(withAppIdentity(drop, lookup)).toEqual({
      ...drop,
      app: { id: 'app1', name: 'App One', ...identity },
    });
  });

  it('keeps the competitor flag of a metadata payload', () => {
    expect(withAppIdentity(change, lookup).app).toEqual({
      id: 'app1',
      name: 'Rival',
      isCompetitor: true,
      ...identity,
    });
  });

  it('leaves events without an app untouched', () => {
    expect(withAppIdentity(entrant, lookup)).toBe(entrant);
    expect(withAppIdentity(digest, lookup)).toBe(digest);
  });

  it('leaves a payload whose app the lookup does not hold untouched', () => {
    expect(withAppIdentity(drop, new Map())).toBe(drop);
  });

  it('never changes the payload it was given', () => {
    withAppIdentity(drop, lookup);
    expect(drop.app).toEqual({ id: 'app1', name: 'App One' });
  });
});

describe('AlertAppIdentities', () => {
  const build = (rows: object[]) => {
    const findMany = jest.fn().mockResolvedValue(rows);
    const identities = new AlertAppIdentities({
      app: { findMany },
    } as unknown as PrismaService);
    return { findMany, identities };
  };

  it('reads no app when there is nothing to look up', async () => {
    const { findMany, identities } = build([]);

    await expect(identities.lookup([])).resolves.toEqual(new Map());
    expect(findMany).not.toHaveBeenCalled();
  });

  it('keys each app it can read by its id', async () => {
    const { identities } = build([{ id: 'app1', ...identity }]);

    await expect(identities.lookup(['app1', 'app2'])).resolves.toEqual(lookup);
  });

  it('attaches the identity it reads', async () => {
    const { identities } = build([{ id: 'app1', ...identity }]);

    await expect(identities.attach(drop)).resolves.toEqual({
      ...drop,
      app: { ...drop.app, ...identity },
    });
  });

  it('leaves the payload as it was when the app is out of scope', async () => {
    const { identities } = build([]);

    await expect(identities.attach(drop)).resolves.toBe(drop);
  });
});
