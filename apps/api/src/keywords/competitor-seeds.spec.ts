import { Store } from '@prisma/client';
import {
  type CompetitorListing,
  type CompetitorSearchContext,
  COMPETITOR_SEED_LIMIT,
  competitorSearches,
  competitorSeeds,
} from './competitor-seeds';

const listing = ({
  appId = 'rival',
  name = null,
  title,
  subtitle = null,
  summary = null,
  languages = [],
}: Partial<CompetitorListing> & { title: string }): CompetitorListing => ({
  appId,
  name,
  title,
  subtitle,
  summary,
  languages,
});

const seedTexts = (listings: CompetitorListing[], store = Store.APP_STORE) =>
  competitorSeeds(listings, store).map((seed) => seed.text);

describe('competitorSeeds', () => {
  it('ranks phrases by how many competitors use them', () => {
    const seeds = competitorSeeds(
      [
        listing({ appId: 'a', title: 'Habit Tracker: Daily Goals' }),
        listing({ appId: 'b', title: 'Habit Tracker & Planner' }),
        listing({ appId: 'c', title: 'Daily Goals Journal' }),
      ],
      Store.APP_STORE,
    );
    expect(seeds.slice(0, 2)).toEqual([
      { text: 'daily goals', usedBy: 2 },
      { text: 'habit tracker', usedBy: 2 },
    ]);
    expect(seeds.slice(2).every((seed) => seed.usedBy === 1)).toBe(true);
  });

  it('keeps at most five', () => {
    const titles = [
      'Focus Timer, Deep Work, Study Planner, Habit Tracker',
      'Sleep Sounds, Daily Goals, Mood Journal',
    ];
    const seeds = competitorSeeds(
      [
        listing({ appId: 'a', title: titles[0], subtitle: titles[1] }),
        listing({ appId: 'b', title: titles[1], subtitle: titles[0] }),
      ],
      Store.APP_STORE,
    );
    expect(seeds).toHaveLength(COMPETITOR_SEED_LIMIT);
  });

  it('keeps phrases of two words or more', () => {
    expect(
      seedTexts([
        listing({ appId: 'a', title: 'Habit' }),
        listing({ appId: 'b', title: 'Tracker' }),
      ]),
    ).toEqual([]);
  });

  it('keeps a spaceless phrase', () => {
    const seeds = seedTexts([
      listing({ appId: 'a', title: '習慣トラッカー 毎日', languages: ['ja'] }),
      listing({ appId: 'b', title: '習慣トラッカー', languages: ['ja'] }),
    ]);
    expect(seeds).toContain('習慣トラッカー');
  });

  it('reads the subtitle on the App Store and the short description on Google Play', () => {
    const text = 'Build better routines';
    expect(
      seedTexts([listing({ title: 'Streaks', subtitle: text })]),
    ).toContain('build better routines');
    expect(
      seedTexts(
        [listing({ title: 'Streaks', summary: text })],
        Store.GOOGLE_PLAY,
      ),
    ).toContain('build better routines');
    expect(
      seedTexts(
        [listing({ title: 'Streaks', subtitle: text })],
        Store.GOOGLE_PLAY,
      ),
    ).toEqual([]);
  });

  it("drops a phrase that is only one competitor's brand", () => {
    const seeds = seedTexts([
      listing({ appId: 'a', title: 'Fab Studio: Habit Tracker' }),
      listing({ appId: 'b', title: 'Streaks: Habit Tracker' }),
    ]);
    expect(seeds).not.toContain('fab studio');
    expect(seeds).toContain('habit tracker');
  });

  it('keeps a brand phrase another competitor also uses in its text', () => {
    const seeds = seedTexts([
      listing({ appId: 'a', title: 'Calm Habits: Sleep' }),
      listing({
        appId: 'b',
        title: 'Dreamer',
        subtitle: 'Sleep sounds for calm habits',
      }),
    ]);
    expect(seeds).toContain('calm habits');
  });

  it('counts a phrase once per competitor', () => {
    expect(
      competitorSeeds(
        [
          listing({
            title: 'Habit Tracker',
            subtitle: 'The habit tracker for you',
          }),
        ],
        Store.APP_STORE,
      ).find((seed) => seed.text === 'habit tracker'),
    ).toEqual({ text: 'habit tracker', usedBy: 1 });
  });

  it('reads each listing in its own languages', () => {
    const seeds = seedTexts([
      listing({
        title: 'Gewohnheiten für Familie und Freunde',
        languages: ['de'],
      }),
    ]);
    for (const seed of seeds) {
      const words = seed.split(' ');
      expect(['für', 'und']).not.toContain(words[0]);
      expect(['für', 'und']).not.toContain(words.at(-1));
    }
    expect(seeds.length).toBeGreaterThan(0);
  });

  it('answers nothing for no competitors', () => {
    expect(competitorSeeds([], Store.APP_STORE)).toEqual([]);
  });
});

describe('competitorSearches', () => {
  const context = (
    overrides: Partial<CompetitorSearchContext> = {},
  ): CompetitorSearchContext => ({
    seeds: [{ text: 'habit tracker', usedBy: 2 }],
    excluded: new Set(['habit tracker app']),
    titles: ['streaks habit tracker'],
    names: ['streaks'],
    limit: 30,
    ...overrides,
  });

  const hint = (term: string, position = 1, seed = 'habit tracker') => ({
    seed,
    position,
    term,
  });

  const textsOf = (terms: string[], overrides = {}) =>
    competitorSearches(
      terms.map((term) => hint(term)),
      context(overrides),
    ).map((search) => search.text);

  it("keeps a search that contains the seed's words", () => {
    expect(
      competitorSearches([hint('habit tracker for adhd', 2)], context()),
    ).toEqual([
      { text: 'habit tracker for adhd', seed: 'habit tracker', usedByCount: 2 },
    ]);
  });

  it('keeps a search whose words are reordered', () => {
    expect(textsOf(['tracker habit daily'])).toEqual(['tracker habit daily']);
  });

  it('drops a search missing a seed word', () => {
    expect(textsOf(['habit planner'])).toEqual([]);
  });

  it('drops what the app already tracks in that market', () => {
    expect(textsOf(['habit tracker app'])).toEqual([]);
  });

  it('drops the seed itself', () => {
    expect(textsOf(['habit tracker'])).toEqual([]);
  });

  it('drops competitor titles and app names', () => {
    expect(textsOf(['streaks habit tracker', 'streaks'])).toEqual([]);
  });

  it('drops app names the store suggests', () => {
    expect(
      textsOf([
        'Habit Tracker: Streaks',
        'Habit - Tracker',
        'Habit Tracker | Daily',
        'Habit Tracker – Goals',
        'Habit Tracker — Goals',
      ]),
    ).toEqual([]);
  });

  it('drops long searches', () => {
    expect(
      textsOf(['best habit tracker for kids', 'best habit tracker kids']),
    ).toEqual(['best habit tracker kids']);
  });

  it('keeps the best position of a search two seeds answered', () => {
    expect(
      competitorSearches(
        [
          hint('daily habit tracker', 4, 'habit tracker'),
          hint('daily habit tracker', 1, 'daily habit'),
        ],
        context({
          seeds: [
            { text: 'habit tracker', usedBy: 2 },
            { text: 'daily habit', usedBy: 1 },
          ],
        }),
      ),
    ).toEqual([
      { text: 'daily habit tracker', seed: 'daily habit', usedByCount: 1 },
    ]);
  });

  it('orders by how many competitors use the seed, then position, then text', () => {
    const seeds = [
      { text: 'habit tracker', usedBy: 1 },
      { text: 'daily goals', usedBy: 3 },
    ];
    expect(
      competitorSearches(
        [
          hint('habit tracker kids', 1, 'habit tracker'),
          hint('daily goals planner', 2, 'daily goals'),
          hint('daily goals app', 2, 'daily goals'),
          hint('daily goals list', 1, 'daily goals'),
        ],
        context({ seeds, excluded: new Set() }),
      ).map((search) => search.text),
    ).toEqual([
      'daily goals list',
      'daily goals app',
      'daily goals planner',
      'habit tracker kids',
    ]);
  });

  it('honours the limit', () => {
    expect(
      textsOf(
        ['habit tracker kids', 'habit tracker daily', 'habit tracker pro'],
        {
          limit: 2,
        },
      ),
    ).toHaveLength(2);
  });

  it("normalizes the store's text", () => {
    expect(textsOf(['Habit Tracker For ADHD', '!!!'])).toEqual([
      'habit tracker for adhd',
    ]);
  });
});
