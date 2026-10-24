import { ACTION_RULE_TITLES } from '@asobeast/shared';
import {
  actionOpened,
  digest,
  dropped,
  droppedOut,
  improved,
  metadata,
  negative,
} from '../email-fixtures.fixture';
import { firstRanking, milestone, overtake } from '../rank-events.fixture';
import { listPhrase, plural, sentenceOf } from './report-sentences';

const withFlags = (payload: Parameters<typeof sentenceOf>[0]) =>
  sentenceOf(payload, true);

describe('sentenceOf', () => {
  it('says a drop with the storefront flag', () => {
    expect(withFlags(dropped)).toEqual({
      emoji: '📉',
      text: 'My App dropped from #4 to #12 for "fitness app" in 🇺🇸 US',
    });
  });

  it('says a drop out of the checked depth', () => {
    expect(withFlags(droppedOut).text).toBe(
      'My App fell out of the top 100 for "fitness app" in 🇺🇸 US, from #3',
    );
  });

  it('prints the storefront without a flag where the channel draws none', () => {
    expect(sentenceOf(dropped, false).text).toBe(
      'My App dropped from #4 to #12 for "fitness app" in US',
    );
  });

  it('says an improvement, also from outside the checked depth', () => {
    expect(withFlags(improved)).toEqual({
      emoji: '📈',
      text: 'My App climbed from #20 to #7 for "habit tracker" in 🇩🇪 DE',
    });
    expect(withFlags({ ...improved, from: null }).text).toBe(
      'My App climbed from outside the top 200 to #7 for "habit tracker" in 🇩🇪 DE',
    );
  });

  it('says a milestone with the glyph of its direction', () => {
    expect(withFlags(milestone())).toEqual({
      emoji: '🏅',
      text: 'My App entered the top 10 for "habit tracker" in 🇺🇸 US: #14 → #8',
    });
    expect(withFlags(milestone({ tier: 1, from: 2, to: 1 })).emoji).toBe('🏆');
    expect(withFlags(milestone({ direction: 'left' })).emoji).toBe('🔻');
  });

  it('says a first ranking and an overtake', () => {
    expect(withFlags(firstRanking())).toEqual({
      emoji: '✨',
      text: 'My App ranks for "habit tracker" in 🇺🇸 US for the first time, at #37',
    });
    expect(withFlags(overtake())).toEqual({
      emoji: '⚔️',
      text: 'Rival Focus overtook My App for "habit tracker" in 🇺🇸 US: Rival Focus #9 → #4, My App #5 → #6',
    });
  });

  it('names the changed fields of a listing in one phrase', () => {
    expect(withFlags(metadata)).toEqual({
      emoji: '📝',
      text: 'My App changed its title and icon',
    });
    expect(
      withFlags({
        ...metadata,
        changes: [
          { field: 'title', before: 'a', after: 'b' },
          { field: 'subtitle', before: 'a', after: 'b' },
          { field: 'whatsNew', before: 'a', after: 'b' },
        ],
      }).text,
    ).toBe("My App changed its title, subtitle and what's new");
  });

  it('calls out a competitor that changed its listing', () => {
    expect(
      withFlags({
        ...metadata,
        app: { id: 'c', name: 'Piñata Farms', isCompetitor: true },
        changes: [{ field: 'icon', before: 'x', after: 'y' }],
      }).text,
    ).toBe('Piñata Farms, a competitor, changed its icon');
  });

  it('says a negative review with its score, version and words', () => {
    expect(withFlags(negative)).toEqual({
      emoji: '⚠️',
      text: 'A 1 star review of My App, v2.0.0: "Crashes on <launch>"',
    });
  });

  it('names a rating only review without a version', () => {
    expect(
      withFlags({
        ...negative,
        review: { ...negative.review, text: '', version: null },
      }).text,
    ).toBe('A 1 star review of My App: no written review');
  });

  it('lists the entrants of a top 10', () => {
    expect(
      withFlags({
        event: 'serp.entrant',
        occurredAt: dropped.occurredAt,
        keyword: { ...dropped.keyword, text: 'memes' },
        date: '2026-10-24',
        entrants: [
          {
            position: 3,
            storeAppId: 's',
            title: 'CloneAI AI Video Generator',
            appId: null,
            isCompetitor: false,
          },
        ],
      }),
    ).toEqual({
      emoji: '🆕',
      text: 'New in the top 10 for "memes" in 🇺🇸 US: #3 CloneAI AI Video Generator',
    });
  });

  it('says a new and a reopened action', () => {
    const title = ACTION_RULE_TITLES['keyword.add_uncovered'];

    expect(withFlags(actionOpened)).toEqual({
      emoji: '🎯',
      text: `High priority action for Alpha: ${title} (impact 71)`,
    });
    expect(
      withFlags({
        ...actionOpened,
        action: { ...actionOpened.action, reopened: true },
      }).text,
    ).toBe(`High priority action reopened for Alpha: ${title} (impact 71)`);
  });

  it('says the weekly digest with its apps and dates', () => {
    expect(withFlags(digest)).toEqual({
      emoji: '🗓️',
      text: 'Weekly digest: 12 apps, 6 to 13 Jul 2026',
    });
  });

  it('names an app the payload sent without a name', () => {
    expect(
      withFlags({ ...dropped, app: { id: 'x', name: null } }).text,
    ).toMatch(/^An app dropped/);
  });
});

describe('listPhrase', () => {
  it('joins one, two and many items', () => {
    expect(listPhrase(['icon'])).toBe('icon');
    expect(listPhrase(['title', 'icon'])).toBe('title and icon');
    expect(listPhrase(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('plural', () => {
  it('counts one and many', () => {
    expect(plural(1, 'change')).toBe('1 change');
    expect(plural(218, 'change')).toBe('218 changes');
  });
});
