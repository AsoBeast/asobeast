import type { KeywordMarkSegment, MetadataField } from '@asobeast/shared';
import type { Surface } from '../metadata/localized-coverage';
import { coversKeyword } from './keyword-coverage';
import { markKeyword } from './keyword-marks';

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
