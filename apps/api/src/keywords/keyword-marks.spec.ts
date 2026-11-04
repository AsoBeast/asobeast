import { Store } from '@prisma/client';
import type { KeywordMarkSegment, MetadataField } from '@asobeast/shared';
import type { ListingTexts, LocalizedTexts } from '../apps/listing-texts';
import { fieldPhrases } from '../metadata/listing-surfaces';
import type { Surface } from '../metadata/localized-coverage';
import { coversKeyword } from './keyword-coverage';
import { keywordMarker, markKeyword } from './keyword-marks';

const surface = (field: MetadataField, value: string): Surface => ({
  field,
  value,
});

const LISTING: Surface[] = [
  surface('title', 'Focus Timer Pro'),
  surface('subtitle', 'Study sessions and café finder'),
  surface('keywordField', 'pomodoro,habit tracker,über'),
];

const SPACE: KeywordMarkSegment = { text: ' ', surface: null };

const cases: Array<{
  keyword: string;
  surfaces?: Surface[];
  marks: KeywordMarkSegment[] | null;
}> = [
  {
    keyword: 'focus timer',
    marks: [{ text: 'focus timer', surface: 'title', match: 'exact' }],
  },
  {
    keyword: 'focus study',
    marks: [
      { text: 'focus', surface: 'title', match: 'exact' },
      SPACE,
      { text: 'study', surface: 'subtitle', match: 'exact' },
    ],
  },
  {
    keyword: 'focus timer study app',
    marks: [
      { text: 'focus timer', surface: 'title', match: 'exact' },
      SPACE,
      { text: 'study', surface: 'subtitle', match: 'exact' },
      { text: ' app', surface: null },
    ],
  },
  {
    keyword: 'habit tracker',
    marks: [{ text: 'habit tracker', surface: 'keywordField', match: 'exact' }],
  },
  {
    keyword: 'cafe finder',
    marks: [
      { text: 'cafe', surface: 'subtitle', match: 'folded' },
      SPACE,
      { text: 'finder', surface: 'subtitle', match: 'exact' },
    ],
  },
  {
    keyword: 'uber',
    marks: [{ text: 'uber', surface: 'keywordField', match: 'folded' }],
  },
  {
    keyword: 'pomodoro timer',
    marks: [
      { text: 'pomodoro', surface: 'keywordField', match: 'exact' },
      SPACE,
      { text: 'timer', surface: 'title', match: 'exact' },
    ],
  },
  {
    keyword: 'focus app timer',
    marks: [
      { text: 'focus', surface: 'title', match: 'exact' },
      { text: ' app ', surface: null },
      { text: 'timer', surface: 'title', match: 'exact' },
    ],
  },
  { keyword: 'nothing here', marks: null },
  {
    keyword: 'タイマー',
    surfaces: [surface('title', '集中タイマーアプリ')],
    marks: [{ text: 'タイマー', surface: 'title', match: 'exact' }],
  },
  {
    keyword: '集中タイマー',
    surfaces: [surface('title', '集中 タイマー アプリ')],
    marks: null,
  },
  {
    keyword: 'ağaç',
    surfaces: [surface('title', 'Agac')],
    marks: [{ text: 'ağaç', surface: 'title', match: 'folded' }],
  },
];

describe('markKeyword', () => {
  it.each(cases)('marks $keyword', ({ keyword, surfaces, marks }) => {
    expect(markKeyword(keyword, surfaces ?? LISTING)).toEqual(marks);
  });

  it('gives a word found in two places the strongest of them', () => {
    expect(
      markKeyword('focus', [
        surface('keywordField', 'focus'),
        surface('title', 'Focus Timer'),
      ]),
    ).toEqual([{ text: 'focus', surface: 'title', match: 'exact' }]);
    expect(
      markKeyword('habit', [
        surface('subtitle', 'Habit coach'),
        surface('keywordField', 'habit'),
      ]),
    ).toEqual([{ text: 'habit', surface: 'subtitle', match: 'exact' }]);
  });

  it('prefers an exact find to a folded one in a stronger place', () => {
    expect(
      markKeyword('uber', [
        surface('title', 'Uber Pro'),
        surface('keywordField', 'über'),
      ]),
    ).toEqual([{ text: 'uber', surface: 'title', match: 'exact' }]);
    expect(
      markKeyword('uber', [
        surface('title', 'Über Pro'),
        surface('keywordField', 'uber'),
      ]),
    ).toEqual([{ text: 'uber', surface: 'keywordField', match: 'exact' }]);
  });

  it('ranks the short description below the title and above the keyword field', () => {
    const play = [
      surface('title', 'Focus Timer'),
      surface('shortDescription', 'Focus with pomodoro sessions'),
      surface('description', 'Pomodoro, focus and sessions'),
    ];

    expect(markKeyword('focus sessions', play)).toEqual([
      { text: 'focus', surface: 'title', match: 'exact' },
      SPACE,
      { text: 'sessions', surface: 'shortDescription', match: 'exact' },
    ]);
    expect(
      markKeyword('pomodoro', [
        surface('keywordField', 'pomodoro'),
        surface('shortDescription', 'Pomodoro sessions'),
      ]),
    ).toEqual([
      { text: 'pomodoro', surface: 'shortDescription', match: 'exact' },
    ]);
  });

  it('never marks a word only the description holds', () => {
    expect(
      markKeyword('deep work', [
        surface('title', 'Focus Timer'),
        surface('description', 'Plan your deep work.'),
      ]),
    ).toBeNull();
  });

  it('marks nothing from an empty surface', () => {
    expect(
      markKeyword('focus', [surface('title', ''), surface('subtitle', '')]),
    ).toBeNull();
  });

  it.each(cases)(
    'joins the runs of $keyword back into the keyword',
    ({ keyword, surfaces }) => {
      const marks = markKeyword(keyword, surfaces ?? LISTING);

      expect(marks?.map((segment) => segment.text).join('') ?? keyword).toBe(
        keyword,
      );
    },
  );

  it.each(cases)(
    'names a match on $keyword exactly where it names a surface',
    ({ keyword, surfaces }) => {
      for (const segment of markKeyword(keyword, surfaces ?? LISTING) ?? []) {
        expect(segment.match !== undefined).toBe(segment.surface !== null);
      }
    },
  );

  it.each([
    ['focus timer', 'title', 'Focus Timer Pro'],
    ['タイマー', 'title', '集中タイマー'],
    ['타이머', 'title', '타이머를'],
    ['habit tracker', 'keywordField', 'mood,habit tracker'],
    ['tracker daily', 'keywordField', 'mood tracker,daily planner'],
  ] as const)(
    'marks every word of %s wherever coverage covers it',
    (keyword, field, value) => {
      expect(coversKeyword(value, keyword)).toBe(true);
      const marks = markKeyword(keyword, [surface(field, value)]) ?? [];

      expect(marks.length).toBeGreaterThan(0);
      for (const segment of marks) {
        expect(segment.surface !== null || segment.text.trim() === '').toBe(
          true,
        );
      }
    },
  );

  it('joins the runs of a decomposed keyword into its composed text', () => {
    const keyword = 'cafe\u0301 finder';
    const marks = markKeyword(keyword, LISTING);

    expect(marks).not.toBeNull();
    expect(marks?.map((segment) => segment.text).join('')).toBe(
      keyword.normalize('NFC'),
    );
  });

  it('marks every run of a repeated word', () => {
    expect(markKeyword('go go', [surface('title', 'Go Timer')])).toEqual([
      { text: 'go go', surface: 'title', match: 'exact' },
    ]);
  });

  it('marks the words of a mixed script keyword by their own surfaces', () => {
    expect(
      markKeyword('pomodoro タイマー', [
        surface('title', '集中タイマー'),
        surface('keywordField', 'pomodoro'),
      ]),
    ).toEqual([
      { text: 'pomodoro', surface: 'keywordField', match: 'exact' },
      SPACE,
      { text: 'タイマー', surface: 'title', match: 'exact' },
    ]);
  });
});

describe('keywordMarker', () => {
  const texts = (overrides: Partial<ListingTexts>): ListingTexts => ({
    id: 'snap',
    title: '',
    subtitle: null,
    summary: null,
    description: '',
    ...overrides,
  });

  const marker = (
    store: Store,
    listings: [string, ListingTexts][],
    fields: { localization: string; phrases: string[] }[] = [],
    localized: [string, LocalizedTexts[]][] = [],
  ) =>
    keywordMarker(
      { store, country: 'us' },
      {
        listings: new Map(listings),
        localized: new Map(localized),
        keywordFields: fieldPhrases(fields),
      },
    );

  const surfacesOf = (marks: KeywordMarkSegment[] | null) =>
    (marks ?? []).flatMap((segment) =>
      segment.surface ? [`${segment.text}:${segment.surface}`] : [],
    );

  const HOME = texts({ title: 'Focus Timer', subtitle: 'Study sessions' });

  it('judges a home keyword against the home listing and its saved field', () => {
    const mark = marker(
      Store.APP_STORE,
      [['us', HOME]],
      [{ localization: 'en-US', phrases: ['pomodoro'] }],
    );

    expect(
      surfacesOf(mark({ country: 'us', text: 'focus study pomodoro' })),
    ).toEqual(['focus:title', 'study:subtitle', 'pomodoro:keywordField']);
  });

  it('judges a market on its own listing and falls back to the home one', () => {
    const mark = marker(Store.APP_STORE, [
      ['us', HOME],
      ['de', texts({ title: 'Gewohnheiten' })],
    ]);

    expect(surfacesOf(mark({ country: 'de', text: 'gewohnheiten' }))).toEqual([
      'gewohnheiten:title',
    ]);
    expect(mark({ country: 'de', text: 'focus' })).toBeNull();
    expect(surfacesOf(mark({ country: 'fr', text: 'focus' }))).toEqual([
      'focus:title',
    ]);
  });

  it('marks a keyword field only in a market that reads a saved one', () => {
    const listings: [string, ListingTexts][] = [
      ['us', HOME],
      ['de', texts({ title: 'Gewohnheiten' })],
    ];
    const homeField = { localization: 'en-US', phrases: ['habit'] };

    expect(
      marker(Store.APP_STORE, listings, [homeField])({
        country: 'de',
        text: 'habit',
      }),
    ).toBeNull();
    expect(
      surfacesOf(
        marker(Store.APP_STORE, listings, [
          homeField,
          { localization: 'de', phrases: ['habit'] },
        ])({ country: 'de', text: 'habit' }),
      ),
    ).toEqual(['habit:keywordField']);
  });

  it('marks a word of another localization the market reads', () => {
    const mark = marker(
      Store.APP_STORE,
      [['us', HOME]],
      [],
      [
        [
          'us',
          [
            {
              localization: 'es-MX',
              texts: texts({ title: 'Temporizador de enfoque' }),
            },
          ],
        ],
      ],
    );

    expect(
      surfacesOf(mark({ country: 'us', text: 'enfoque temporizador' })),
    ).toEqual(['enfoque temporizador:title']);
  });

  it('marks a Google Play title and short description and never the description', () => {
    const mark = marker(
      Store.GOOGLE_PLAY,
      [
        [
          'us',
          texts({
            title: 'Focus Timer',
            summary: 'Pomodoro sessions',
            description: 'Plan your deep work.',
          }),
        ],
      ],
      [{ localization: 'en-US', phrases: ['habit'] }],
      [
        [
          'us',
          [{ localization: 'es-MX', texts: texts({ title: 'Temporizador' }) }],
        ],
      ],
    );

    expect(surfacesOf(mark({ country: 'us', text: 'focus pomodoro' }))).toEqual(
      ['focus:title', 'pomodoro:shortDescription'],
    );
    expect(mark({ country: 'us', text: 'deep work' })).toBeNull();
    expect(mark({ country: 'us', text: 'habit' })).toBeNull();
    expect(mark({ country: 'us', text: 'temporizador' })).toBeNull();
  });
});
