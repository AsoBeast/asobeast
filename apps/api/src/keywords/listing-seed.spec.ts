import { Store } from '@prisma/client';
import { MARKET_SEED_LIMIT } from '@asobeast/shared';
import { coversKeyword } from './keyword-coverage';
import { seedCandidates, seedSources } from './listing-seed';
import { ListingText } from './listing-texts';

const NATIVE: ListingText = {
  title: 'Quiz Geograficzny',
  subtitle: 'Mapa Świata',
  summary: null,
  languages: ['pl'],
};

const DEFAULT: ListingText = {
  title: 'GeoGuess Map Quiz',
  subtitle: 'Geography Trivia',
  summary: null,
  languages: ['en'],
};

describe('seedSources', () => {
  it.each([
    [Store.APP_STORE, ['TITLE', 'SUBTITLE']],
    [Store.GOOGLE_PLAY, ['TITLE', 'DESCRIPTION']],
  ])('seeds a %s listing from %j', (store, sources) => {
    expect(seedSources(store)).toEqual(sources);
  });
});

describe('seedCandidates', () => {
  it('takes phrases of the native localization and the default in turn', () => {
    const candidates = seedCandidates(Store.APP_STORE, [NATIVE, DEFAULT]);
    const texts = candidates.map((candidate) => candidate.text);

    expect(texts[0]).toBe('quiz geograficzny');
    expect(texts[1]).toBe('geoguess map quiz');
    expect(texts).toContain('mapa świata');
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.length).toBeLessThanOrEqual(MARKET_SEED_LIMIT);
    expect(
      candidates.every((candidate) =>
        ['TITLE', 'SUBTITLE'].includes(candidate.source),
      ),
    ).toBe(true);
  });

  it('answers every candidate of the seeded sources under a larger limit', () => {
    const LONG: ListingText = {
      title: 'Habit Tracker Daily Planner Streaks Goals Routine Reminders',
      subtitle: 'Mood Journal Water Sleep Focus Timer Fitness Diary Notes',
      summary: 'A long summary that is never seeded on the app store',
      languages: ['en'],
    };

    const limited = seedCandidates(Store.APP_STORE, [LONG]);
    const all = seedCandidates(Store.APP_STORE, [LONG], 200);

    expect(limited).toHaveLength(MARKET_SEED_LIMIT);
    expect(all.length).toBeGreaterThan(MARKET_SEED_LIMIT);
    expect(
      all.every((candidate) =>
        ['TITLE', 'SUBTITLE'].includes(candidate.source),
      ),
    ).toBe(true);
  });

  it('seeds nothing from no listing', () => {
    expect(seedCandidates(Store.APP_STORE, [])).toEqual([]);
  });

  describe('a phrase its own field holds word for word', () => {
    const fieldOf = (listing: ListingText, source: string): string =>
      ({
        TITLE: listing.title,
        SUBTITLE: listing.subtitle,
        DESCRIPTION: listing.summary,
      })[source] ?? '';

    it.each([
      {
        name: 'Flighty, app store us',
        store: Store.APP_STORE,
        listing: {
          title: 'Flighty – Live Flight Tracker',
          subtitle: "World's Fastest Delay Alerts",
          summary: null,
          languages: ['en'],
        },
        gone: ['world fastest', 'world fastest delay'],
        kept: ['fastest delay alerts', 'world', 'fastest'],
      },
      {
        name: 'Vinted, google play fr',
        store: Store.GOOGLE_PLAY,
        listing: {
          title: 'Vinted : shopping seconde main',
          subtitle: null,
          summary:
            '(Re)joins des millions de membres adeptes de la seconde main !',
          languages: ['fr'],
        },
        gone: [
          'joins millions',
          'joins millions membres',
          'millions membres',
          'millions membres adeptes',
          're joins millions',
          'membres adeptes seconde',
          'adeptes seconde main',
          'adeptes seconde',
        ],
        kept: ['re joins', 'membres adeptes', 'seconde main', 'millions'],
      },
      {
        name: 'talabat, app store kw',
        store: Store.APP_STORE,
        listing: {
          title: 'talabat: Food & Grocery',
          subtitle: 'طلبات كل يوم',
          summary: null,
          languages: ['ar'],
        },
        gone: ['طلبات يوم'],
        kept: ['طلبات', 'يوم'],
      },
    ])(
      'seeds only phrases its field covers for $name',
      ({ store, listing, gone, kept }) => {
        const candidates = seedCandidates(store, [listing], 200);
        const texts = candidates.map((candidate) => candidate.text);

        for (const text of gone) {
          expect(texts).not.toContain(text);
        }
        for (const text of kept) {
          expect(texts).toContain(text);
        }
        expect(
          candidates.filter(
            (candidate) =>
              !coversKeyword(
                fieldOf(listing, candidate.source),
                candidate.text,
              ),
          ),
        ).toEqual([]);
      },
    );

    it('seeds a phrase the title breaks from the field that holds it whole', () => {
      const listing: ListingText = {
        title: 'Juegos de Trivia',
        subtitle: null,
        summary: 'Juegos trivia con amigos',
        languages: ['es'],
      };

      const candidates = seedCandidates(Store.GOOGLE_PLAY, [listing], 200);

      expect(candidates).toContainEqual(
        expect.objectContaining({
          text: 'juegos trivia',
          source: 'DESCRIPTION',
        }),
      );
      expect(candidates).toContainEqual(
        expect.objectContaining({ text: 'juegos', source: 'TITLE' }),
      );
    });

    it('fills every seed slot when a long title breaks most of its phrases', () => {
      const words = [
        'alpha',
        'bravo',
        'charlie',
        'delta',
        'echo',
        'foxtrot',
        'golf',
        'hotel',
        'india',
        'juliet',
        'kilo',
        'lima',
        'mike',
        'november',
        'oscar',
        'papa',
        'quebec',
        'romeo',
        'sierra',
        'tango',
        'uniform',
        'victor',
        'whiskey',
        'xray',
        'yankee',
        'zulu',
      ];
      const listing: ListingText = {
        title: words.join(' the '),
        subtitle: 'Mood Journal Water Sleep',
        summary: null,
        languages: ['en'],
      };

      const seeded = seedCandidates(Store.APP_STORE, [listing]);
      const all = seedCandidates(Store.APP_STORE, [listing], 200);

      expect(seeded).toHaveLength(MARKET_SEED_LIMIT);
      expect(all.map((candidate) => candidate.text)).toEqual(
        expect.arrayContaining([...words, 'mood journal water', 'sleep']),
      );
      expect(all).toHaveLength(words.length + 9);
    });
  });
});
