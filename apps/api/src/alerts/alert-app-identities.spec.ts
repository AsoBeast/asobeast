import {
  DigestWeeklyPayload,
  MetadataChangedPayload,
  RANK_DEPTH,
  RankDroppedPayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AlertAppIdentities, withAppIdentity } from './alert-app-identities';

const identity = {
  iconUrl: 'https://play-lh.googleusercontent.com/icon',
  store: 'GOOGLE_PLAY' as const,
  country: 'de',
};

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

describe('withAppIdentity', () => {
  it('adds the icon, store and storefront to a rank payload', () => {
    expect(withAppIdentity(drop, identity)).toEqual({
      ...drop,
      app: { id: 'app1', name: 'App One', ...identity },
    });
  });

  it('keeps the competitor flag of a metadata payload', () => {
    expect(withAppIdentity(change, identity).app).toEqual({
      id: 'app1',
      name: 'Rival',
      isCompetitor: true,
      ...identity,
    });
  });

  it('leaves events without an app untouched', () => {
    expect(withAppIdentity(entrant, identity)).toBe(entrant);
    expect(withAppIdentity(digest, identity)).toBe(digest);
  });

  it('leaves a payload whose app could not be read untouched', () => {
    expect(withAppIdentity(drop, null)).toBe(drop);
  });

  it('never changes the payload it was given', () => {
    withAppIdentity(drop, identity);
    expect(drop.app).toEqual({ id: 'app1', name: 'App One' });
  });
});

describe('AlertAppIdentities', () => {
  const build = (row: object | null) => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const identities = new AlertAppIdentities({
      app: { findUnique },
    } as unknown as PrismaService);
    return { findUnique, identities };
  };

  it('reads the icon, store and storefront of the payload app', async () => {
    const { findUnique, identities } = build(identity);

    await expect(identities.attach(drop)).resolves.toEqual({
      ...drop,
      app: { ...drop.app, ...identity },
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'app1' },
      select: { iconUrl: true, store: true, country: true },
    });
  });

  it('reads no app for an event that names none', async () => {
    const { findUnique, identities } = build(identity);

    await expect(identities.attach(entrant)).resolves.toBe(entrant);
    await expect(identities.attach(digest)).resolves.toBe(digest);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('leaves the payload as it was when the app is out of scope', async () => {
    const { identities } = build(null);

    await expect(identities.attach(drop)).resolves.toBe(drop);
  });
});
