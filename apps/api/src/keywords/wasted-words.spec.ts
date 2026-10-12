import { Store } from '@prisma/client';
import {
  type AppStoreLocalization,
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
  keywordFieldLocalizations,
  type MarketLocalizationRead,
} from '@asobeast/shared';
import { judgingSurfaces } from '../metadata/listing-surfaces';
import { localizationGroups, splitPhrases, wastedWords } from './wasted-words';

const read = (
  localization: AppStoreLocalization,
  phrases: string[],
  shipped = true,
): MarketLocalizationRead => ({
  localization,
  role: 'additional',
  shipped,
  origin: shipped ? 'manual' : null,
  phrases,
  charactersUsed: keywordFieldChars(phrases),
  charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
});

const phrase = (text: string, keywordId = text) => ({ keywordId, text });

const group = (localization: AppStoreLocalization, text: string) => ({
  localization,
  text,
});

const words = (result: { word: string }[]) => result.map(({ word }) => word);

describe('wastedWords', () => {
  it('reports a word that two shipped localizations hold, in read order', () => {
    expect(
      wastedWords([
        read('en-US', ['habit', 'tracker']),
        read('es-MX', ['tracker', 'planner']),
      ]),
    ).toEqual([{ word: 'tracker', localizations: ['en-US', 'es-MX'] }]);
  });

  it('does not report a word repeated inside one field', () => {
    expect(wastedWords([read('en-US', ['habit tracker', 'tracker'])])).toEqual(
      [],
    );
  });

  it('skips stopwords', () => {
    expect(
      words(
        wastedWords([
          read('en-US', ['the app', 'free tracker']),
          read('es-MX', ['the tracker', 'app timer']),
        ]),
      ),
    ).toEqual(['tracker']);
  });

  it('compares words after normalization', () => {
    expect(
      words(
        wastedWords([
          read('en-US', ['Habit-Tracker']),
          read('es-MX', ['habit, tracker!']),
        ]),
      ),
    ).toEqual(['habit', 'tracker']);
  });

  it('ignores a localization the app does not ship', () => {
    expect(
      wastedWords([
        read('en-US', ['tracker']),
        read('es-MX', ['tracker'], false),
      ]),
    ).toEqual([]);
  });

  it('lists every localization that holds the word', () => {
    expect(
      wastedWords([
        read('en-US', ['timer']),
        read('es-MX', ['timer']),
        read('fr', ['timer']),
      ]),
    ).toEqual([{ word: 'timer', localizations: ['en-US', 'es-MX', 'fr'] }]);
  });

  it('sorts the words alphabetically', () => {
    expect(
      words(
        wastedWords([
          read('en-US', ['zen', 'alarm']),
          read('es-MX', ['zen', 'alarm']),
        ]),
      ),
    ).toEqual(['alarm', 'zen']);
  });

  it('reports nothing when no word repeats or only one localization is read', () => {
    expect(
      wastedWords([read('en-US', ['habit']), read('es-MX', ['planner'])]),
    ).toEqual([]);
    expect(wastedWords([read('en-US', ['habit', 'habit tracker'])])).toEqual(
      [],
    );
    expect(wastedWords([])).toEqual([]);
  });

  it('splits multi word phrases into words', () => {
    expect(
      wastedWords([
        read('en-US', ['habit tracker']),
        read('es-MX', ['tracker app']),
      ]),
    ).toEqual([{ word: 'tracker', localizations: ['en-US', 'es-MX'] }]);
  });

  it('compares an unsegmented run whole', () => {
    expect(
      words(
        wastedWords([
          read('ja', ['ダイエット']),
          read('en-US', ['ダイエット']),
        ]),
      ),
    ).toEqual(['ダイエット']);
    expect(
      wastedWords([
        read('ja', ['ダイエット記録']),
        read('en-US', ['ダイエット']),
      ]),
    ).toEqual([]);
  });
});

describe('splitPhrases', () => {
  it('reports a phrase whose words sit in two localizations', () => {
    expect(
      splitPhrases({
        phrases: [phrase('habit planner')],
        groups: [group('en-US', 'habit tracker'), group('es-MX', 'planner')],
      }),
    ).toEqual([
      {
        keywordId: 'habit planner',
        phrase: 'habit planner',
        parts: [
          { word: 'habit', localizations: ['en-US'] },
          { word: 'planner', localizations: ['es-MX'] },
        ],
      },
    ]);
  });

  it('reports nothing when one localization holds every word', () => {
    expect(
      splitPhrases({
        phrases: [phrase('habit planner')],
        groups: [group('en-US', 'habit planner'), group('es-MX', 'planner')],
      }),
    ).toEqual([]);
  });

  it('reports nothing when a word is held nowhere', () => {
    expect(
      splitPhrases({
        phrases: [phrase('habit planner')],
        groups: [group('en-US', 'habit'), group('es-MX', 'tracker')],
      }),
    ).toEqual([]);
  });

  it('skips a phrase of one word', () => {
    expect(
      splitPhrases({
        phrases: [phrase('habit'), phrase('the habit')],
        groups: [group('en-US', 'habit'), group('es-MX', 'the')],
      }),
    ).toEqual([]);
  });

  it('drops stopwords from the phrase before judging', () => {
    expect(
      splitPhrases({
        phrases: [phrase('habit of planner')],
        groups: [group('en-US', 'habit'), group('es-MX', 'planner')],
      }),
    ).toEqual([
      {
        keywordId: 'habit of planner',
        phrase: 'habit of planner',
        parts: [
          { word: 'habit', localizations: ['en-US'] },
          { word: 'planner', localizations: ['es-MX'] },
        ],
      },
    ]);
  });

  it('lists every localization that holds a word, in group order', () => {
    expect(
      splitPhrases({
        phrases: [phrase('habit planner')],
        groups: [
          group('en-US', 'habit'),
          group('es-MX', 'planner'),
          group('fr', 'habit'),
        ],
      })[0].parts,
    ).toEqual([
      { word: 'habit', localizations: ['en-US', 'fr'] },
      { word: 'planner', localizations: ['es-MX'] },
    ]);
  });

  it('skips a phrase in an unsegmented script', () => {
    expect(
      splitPhrases({
        phrases: [
          phrase('ダイエット 記録'),
          phrase('운동 기록'),
          phrase('วิ่ง ออกกำลังกาย'),
        ],
        groups: [
          group('ja', 'ダイエット 운동 วิ่ง'),
          group('ko', '記録 기록 ออกกำลังกาย'),
        ],
      }),
    ).toEqual([]);
  });

  it('finds a latin word written against japanese text', () => {
    expect(
      splitPhrases({
        phrases: [phrase('habit tracker')],
        groups: [group('en-US', 'habit'), group('ja', 'タイマー tracker')],
      })[0]?.parts,
    ).toEqual([
      { word: 'habit', localizations: ['en-US'] },
      { word: 'tracker', localizations: ['ja'] },
    ]);
  });

  it('sorts the phrases alphabetically', () => {
    expect(
      splitPhrases({
        phrases: [phrase('zen planner'), phrase('alarm planner')],
        groups: [group('en-US', 'zen alarm'), group('es-MX', 'planner')],
      }).map((entry) => entry.phrase),
    ).toEqual(['alarm planner', 'zen planner']);
  });

  it('reports nothing when a third localization holds every word', () => {
    expect(
      splitPhrases({
        phrases: [phrase('habit planner')],
        groups: [group('en-US', 'habit'), group('fr', 'habit planner')],
      }),
    ).toEqual([]);
  });

  it('matches whole words only', () => {
    expect(
      splitPhrases({
        phrases: [phrase('map habit')],
        groups: [group('en-US', 'roadmap'), group('es-MX', 'habit')],
      }),
    ).toEqual([]);
  });

  it('counts a repeated word of the phrase once', () => {
    expect(
      splitPhrases({
        phrases: [phrase('habit habit planner')],
        groups: [group('en-US', 'habit'), group('es-MX', 'planner')],
      })[0]?.parts,
    ).toHaveLength(2);
  });
});

describe('localizationGroups', () => {
  it('puts the primary localization first and joins title, subtitle and keyword field', () => {
    expect(
      localizationGroups(['en-US'], {
        surfaces: [
          { field: 'title', value: 'Habit Garden' },
          { field: 'subtitle', value: 'Daily routines' },
          { field: 'keywordField', value: 'habit,tracker' },
        ],
        localized: [],
      }),
    ).toEqual([
      {
        localization: 'en-US',
        text: 'Habit Garden Daily routines habit,tracker',
      },
    ]);
  });

  it('adds one group per localized surface list in the order given', () => {
    expect(
      localizationGroups(['en-US', 'es-MX'], {
        surfaces: [{ field: 'title', value: 'Habit' }],
        localized: [
          {
            localization: 'es-MX',
            surfaces: [{ field: 'keywordField', value: 'planner' }],
          },
        ],
      }),
    ).toEqual([
      { localization: 'en-US', text: 'Habit' },
      { localization: 'es-MX', text: 'planner' },
    ]);
  });

  it('agrees with judgingSurfaces for a market without a stored listing', () => {
    const groups = localizationGroups(
      keywordFieldLocalizations('us'),
      judgingSurfaces(
        {
          store: Store.APP_STORE,
          country: 'us',
          home: false,
          listing: undefined,
          captured: [],
        },
        new Map([['es-MX', ['planner']]]),
      ),
    );

    expect(
      groups.map(({ localization, text }) => ({
        localization,
        text: text.trim(),
      })),
    ).toEqual([
      { localization: 'en-US', text: '' },
      { localization: 'es-MX', text: 'planner' },
    ]);
  });
});
