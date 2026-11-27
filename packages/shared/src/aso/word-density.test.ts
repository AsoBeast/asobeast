import { describe, expect, it } from 'vitest';

import {
  countWords,
  DENSITY_ROW_LIMIT,
  withoutLinks,
  wordDensity,
} from './word-density';

const english = { language: 'en' };

const texts = (rows: readonly { text: string }[]): string[] =>
  rows.map((row) => row.text);

describe('countWords', () => {
  it('counts nothing in an empty or blank text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t')).toBe(0);
  });

  it('counts words the way a reader does', () => {
    expect(countWords("Don't miss it: e-mail 3.5 times, 24/7!")).toBe(7);
  });

  it('skips chunks with no letter or digit', () => {
    expect(countWords('• one — two ✓')).toBe(2);
  });

  it('leaves out links and addresses', () => {
    expect(
      countWords(
        'Visit https://example.com/help or mail help@example.com today',
      ),
    ).toBe(4);
    expect(countWords('Open www.example.com now')).toBe(2);
  });

  it('counts a German compound as one word', () => {
    expect(countWords('Produktivitätsmanagementsoftwarelösung hilft')).toBe(2);
  });

  it('splits a Japanese run into dictionary words', () => {
    expect(countWords('集中タイマーで勉強時間を管理します。')).toBe(9);
  });

  it('counts mixed scripts', () => {
    expect(countWords('Pomodoro タイマー app')).toBe(3);
    expect(countWords('Pomodoroタイマー')).toBe(2);
  });
});

describe('withoutLinks', () => {
  it('blanks links and addresses where they stand', () => {
    const text = 'See https://x.com/a, mail a@b.co or www.c.org now';

    expect(withoutLinks(text)).toBe(
      `See ${' '.repeat(16)} mail ${' '.repeat(6)} or ${' '.repeat(9)} now`,
    );
  });

  it('blanks an address whatever surrounds its at sign', () => {
    expect(withoutLinks('@a@b.c x a@b.c. y a@.b z ab@c.')).toBe(
      `${' '.repeat(6)} x ${' '.repeat(6)} y a@.b z ab@c.`,
    );
  });
});

describe('withoutLinks in linear time', () => {
  it.each([
    ['exclamation marks', '!'.repeat(4000)],
    ['exclamation marks and at signs', '!@'.repeat(2000)],
    ['at signs and dots', '@.'.repeat(2000)],
  ])('scans a description of %s in linear time', (_, text) => {
    const started = performance.now();
    withoutLinks(text);
    countWords(text);

    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe('wordDensity', () => {
  it('answers nothing for an empty text', () => {
    expect(wordDensity('', english)).toEqual({
      words: 0,
      single: [],
      pairs: [],
      triples: [],
    });
    expect(wordDensity('  \n ', english)).toEqual({
      words: 0,
      single: [],
      pairs: [],
      triples: [],
    });
  });

  it('ranks words by count then by text', () => {
    const text = 'timer focus study. timer focus study. timer focus.';
    const density = wordDensity(text, english);

    expect(density.words).toBe(8);
    expect(density.single).toEqual([
      { text: 'focus', count: 3, share: 3 / 8 },
      { text: 'timer', count: 3, share: 3 / 8 },
      { text: 'study', count: 2, share: 2 / 8 },
    ]);
  });

  it('lists only words the description repeats', () => {
    const density = wordDensity(
      'A calm planner keeps every study session quiet, focused and simple for busy students who want less noise today.',
      english,
    );

    expect(density.words).toBe(19);
    expect(density.single).toEqual([]);
  });

  it('cuts each list at twenty rows', () => {
    const words = Array.from(
      { length: 25 },
      (_, index) => `word${String.fromCharCode(97 + index)}`,
    );
    const density = wordDensity([...words, ...words].join(' '), english);

    expect(density.single).toHaveLength(DENSITY_ROW_LIMIT);
    expect(density.single[0]).toEqual({
      text: 'worda',
      count: 2,
      share: 2 / 50,
    });
  });

  it('leaves out the function words of the listing language only', () => {
    const englishText = 'the planner and the timer with the planner and timer';
    expect(texts(wordDensity(englishText, english).single)).toEqual([
      'planner',
      'timer',
    ]);

    const german = 'der Planer und der Timer mit dem Planer und mit Timer';
    expect(texts(wordDensity(german, { language: 'de' }).single)).toEqual([
      'planer',
      'timer',
    ]);
    expect(texts(wordDensity(german, english).single)).toContain('und');
  });

  it('keeps store words', () => {
    const density = wordDensity('free best app. free best app.', english);

    expect(texts(density.single)).toEqual(['app', 'best', 'free']);
  });

  it('leaves out the app name and the title', () => {
    const density = wordDensity(
      'Focus Flow helps you study. The study timer keeps focus. Calm calm, it helps and keeps.',
      { language: 'en', ignored: ['Focus Flow', 'Focus Flow: Study Timer'] },
    );

    expect(texts(density.single)).toEqual(['calm', 'helps', 'keeps']);
  });

  it('leaves out numbers and one character tokens', () => {
    const density = wordDensity('24 7 3 x plan 24 7 3 x plan', english);
    expect(texts(density.single)).toEqual(['plan']);

    const russian = wordDensity('план и цель и план и цель', {
      language: 'ru',
    });
    expect(texts(russian.single)).toEqual(['план', 'цель']);
  });

  it('leaves out links', () => {
    const density = wordDensity(
      'Help at https://example.com/help and www.example.com or help@example.com and help',
      { language: null },
    );

    expect(texts(density.single)).toEqual(['and', 'help']);
  });

  it('keeps a German compound whole', () => {
    const density = wordDensity(
      'Produktivitätsmanagementsoftwarelösung und Produktivitätsmanagementsoftwarelösung',
      { language: 'de' },
    );

    expect(density.single).toEqual([
      {
        text: 'produktivitätsmanagementsoftwarelösung',
        count: 2,
        share: 2 / 3,
      },
    ]);
  });

  it('finds repeated two word phrases inside one segment', () => {
    const density = wordDensity(
      'Study timer for exams. Study timer for focus. study timer.',
      english,
    );

    expect(density.pairs).toEqual([
      { text: 'study timer', count: 3, share: 6 / 10 },
    ]);
  });

  it('never ends or starts a phrase on a function word', () => {
    const density = wordDensity(
      'Study timer for exams. Study timer for focus. study timer.',
      english,
    );

    expect(density.triples).toEqual([]);
  });

  it('never starts a repeated phrase on a function word', () => {
    const density = wordDensity(
      'The planner works. The planner helps. The planner waits.',
      english,
    );

    expect(density.pairs).toEqual([]);
    expect(density.triples).toEqual([]);
  });

  it('takes a share from the words the table counts', () => {
    const density = wordDensity('timer/timer timer/timer', english);

    expect(density.words).toBe(2);
    expect(density.single).toEqual([{ text: 'timer', count: 4, share: 1 }]);
  });

  it('keeps function words inside a phrase', () => {
    const density = wordDensity(
      'time to focus. time to focus. time to focus.',
      english,
    );

    expect(density.triples).toEqual([
      { text: 'time to focus', count: 3, share: 1 },
    ]);
  });

  it('never builds a phrase across a sentence or a comma', () => {
    const density = wordDensity(
      'study. timer, study. timer! study? timer\nstudy; timer',
      english,
    );

    expect(density.pairs).toEqual([]);
  });

  it('computes a phrase share from its words', () => {
    const filler = Array.from(
      { length: 24 },
      (_, index) => `filler${String.fromCharCode(97 + index)}`,
    ).join(' ');
    const density = wordDensity(
      `daily planner. daily planner. daily planner. ${filler}`,
      english,
    );

    expect(density.words).toBe(30);
    expect(density.pairs).toEqual([
      { text: 'daily planner', count: 3, share: 0.2 },
    ]);
  });

  it('hides phrases when most words come from spaceless runs', () => {
    const density = wordDensity(
      '专注计时器帮助你学习。专注计时器帮助你学习。',
      {
        language: 'zh',
      },
    );

    expect(density.pairs).toBeNull();
    expect(density.triples).toBeNull();
    expect(density.single.length).toBeGreaterThan(0);
  });

  it('joins spaceless phrases without a space', () => {
    const density = wordDensity(
      'Focus 集中タイマー daily planner. Focus 集中タイマー daily planner. Focus planner timer study.',
      { language: null },
    );

    expect(texts(density.pairs ?? [])).toContain('集中タイマー');
    expect(texts(density.pairs ?? [])).toContain('daily planner');
  });

  it('reads Japanese words with the segmenter', () => {
    const density = wordDensity('集中タイマーで勉強。集中タイマーで休憩。', {
      language: 'ja',
    });

    expect(density.single).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '集中', count: 2 }),
        expect.objectContaining({ text: 'タイマー', count: 2 }),
      ]),
    );
    expect(texts(density.single)).not.toContain('で');
  });

  it('keeps accents apart', () => {
    const density = wordDensity('café cafe café cafe', { language: 'fr' });

    expect(texts(density.single)).toEqual(['cafe', 'café']);
  });

  it('lowers Turkish capitals correctly', () => {
    const density = wordDensity('İstanbul istanbul', { language: 'tr' });

    expect(density.single).toEqual([{ text: 'istanbul', count: 2, share: 1 }]);
  });

  it('is deterministic', () => {
    const text = 'Study timer for exams. Study timer for focus. study timer.';

    expect(wordDensity(text, english)).toEqual(wordDensity(text, english));
  });
});
