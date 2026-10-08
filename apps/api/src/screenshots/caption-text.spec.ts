import {
  CAPTION_HEIGHT_RATIO,
  joinSpacelessRuns,
  MAX_CAPTION_CHARS,
  MIN_LINE_CONFIDENCE,
  MIN_SINGLE_LINE_SHARE,
  OcrLine,
  selectCaption,
} from './caption-text';

const IMAGE_HEIGHT = 2341;

const line = (
  text: string,
  height: number,
  top: number,
  confidence = 96,
): OcrLine => ({ text, height, top, confidence, left: 0, width: 900 });

const FRAME = 1920;

const at = (
  text: string,
  box: { left: number; top: number; width: number; height: number },
  confidence = 95,
): OcrLine => ({ text, confidence, ...box });

describe('joinSpacelessRuns', () => {
  it('removes the spaces the engine puts between japanese words', () => {
    expect(joinSpacelessRuns('毎日 の 習慣 を 記録 し よう')).toBe(
      '毎日の習慣を記録しよう',
    );
  });

  it('keeps the space between a latin word and a japanese one', () => {
    expect(joinSpacelessRuns('iPhone 用 カメラ')).toBe('iPhone 用カメラ');
  });

  it('leaves latin text and korean text alone', () => {
    expect(joinSpacelessRuns('Track every habit')).toBe('Track every habit');
    expect(joinSpacelessRuns('운동 기록')).toBe('운동 기록');
  });

  it('collapses any run of whitespace to one space', () => {
    expect(joinSpacelessRuns('a \n  b')).toBe('a b');
  });
});

describe('selectCaption', () => {
  it('keeps the headline and drops the interface text in the device frame', () => {
    const lines = [
      line('Track every habit', 102, 198),
      line('Build lasting streaks', 103, 323),
      line("Today's habits", 44, 720),
      line('Drink water 8 glasses', 35, 819),
      line('Free to start', 43, 2219),
    ];

    expect(selectCaption(lines, IMAGE_HEIGHT)).toBe(
      'Track every habit Build lasting streaks',
    );
  });

  it('orders the kept lines from the top of the image', () => {
    const lines = [line('second line', 100, 210), line('first line', 100, 100)];

    expect(selectCaption(lines, IMAGE_HEIGHT)).toBe('first line second line');
  });

  it('keeps a line that is nearly as tall as the tallest', () => {
    const tallest = 200;
    const lines = [
      line('big', tallest, 100),
      line('kept', tallest * CAPTION_HEIGHT_RATIO + 1, 305),
      line('dropped', tallest * CAPTION_HEIGHT_RATIO - 1, 400),
    ];

    expect(selectCaption(lines, IMAGE_HEIGHT)).toBe('big kept');
  });

  it('drops a line the engine was not confident about', () => {
    const lines = [
      line('Sleep better tonight', 104, 196),
      line('xq zv', 104, 323, MIN_LINE_CONFIDENCE - 1),
    ];

    expect(selectCaption(lines, IMAGE_HEIGHT)).toBe('Sleep better tonight');
  });

  it('reads a screenshot that only shows interface text as blank', () => {
    const lines = [
      line("Today's habits", 44, 720),
      line('Drink water 8 glasses', 35, 819),
    ];

    expect(selectCaption(lines, IMAGE_HEIGHT)).toBeNull();
  });

  it('drops lines that carry no letter or digit', () => {
    expect(
      selectCaption(
        [line('*** ###', 120, 100), line('Hello', 110, 300)],
        IMAGE_HEIGHT,
      ),
    ).toBe('Hello');
  });

  it('returns null when nothing was read', () => {
    expect(selectCaption([], IMAGE_HEIGHT)).toBeNull();
  });

  it('joins japanese words without spaces', () => {
    expect(selectCaption([line('毎日 の 習慣', 100, 200)], IMAGE_HEIGHT)).toBe(
      '毎日の習慣',
    );
  });

  it('caps a caption at the maximum length', () => {
    const long = 'w'.repeat(MAX_CAPTION_CHARS * 2);

    expect(selectCaption([line(long, 100, 200)], IMAGE_HEIGHT)).toHaveLength(
      MAX_CAPTION_CHARS,
    );
  });

  it('never cuts an astral character in half at the maximum length', () => {
    const long = `${'w'.repeat(MAX_CAPTION_CHARS - 1)}${'𝐀'.repeat(4)}`;

    const caption = selectCaption([line(long, 100, 200)], IMAGE_HEIGHT) ?? '';

    expect(() => encodeURIComponent(caption)).not.toThrow();
    expect(Array.from(caption)).toHaveLength(MAX_CAPTION_CHARS);
    expect(caption.endsWith('𝐀')).toBe(true);
  });

  it('cleans stray punctuation the engine leaves at the edges', () => {
    expect(
      selectCaption([line('  | Plan your week ,', 100, 200)], IMAGE_HEIGHT),
    ).toBe('Plan your week');
  });
});

describe('selectCaption on the issue screenshots', () => {
  it('never lets a one letter blob set the height floor', () => {
    const lines = [
      at('Explore', { left: 330, top: 120, width: 420, height: 80 }),
      at('I', { left: 520, top: 1199, width: 30, height: 94 }, 78),
    ];

    expect(selectCaption(lines, FRAME)).toBe('Explore');
  });

  it('keeps a caption shorter than a texture the engine read as letters', () => {
    const lines = [
      at('Fall in love', { left: 240, top: 130, width: 600, height: 70 }),
      at('fi', { left: 610, top: 698, width: 60, height: 143 }, 75),
      at('| j', { left: 700, top: 760, width: 40, height: 89 }, 72),
    ];

    expect(selectCaption(lines, FRAME)).toBe('Fall in love');
  });

  it('drops a stray letter far from a two line caption', () => {
    const lines = [
      at('Select your', { left: 250, top: 110, width: 580, height: 70 }),
      at('adventure', { left: 290, top: 195, width: 500, height: 70 }),
      at('f', { left: 120, top: 1245, width: 40, height: 104 }, 77),
    ];

    expect(selectCaption(lines, FRAME)).toBe('Select your adventure');
  });

  it('reads the caption and not a big button inside the device frame', () => {
    const lines = [
      at('Guess', { left: 390, top: 120, width: 300, height: 70 }),
      at('Play again', { left: 340, top: 1480, width: 400, height: 40 }),
    ];

    expect(selectCaption(lines, FRAME)).toBe('Guess');
  });

  it('drops interface labels in the device frame below a long caption', () => {
    const lines = [
      at('Earn badges and become', {
        left: 90,
        top: 100,
        width: 900,
        height: 60,
      }),
      at('the King of the World', {
        left: 150,
        top: 178,
        width: 780,
        height: 60,
      }),
      at('Badges 3/180', { left: 380, top: 700, width: 320, height: 36 }),
      at('Leaning', { left: 420, top: 820, width: 200, height: 34 }),
    ];

    expect(selectCaption(lines, FRAME)).toBe(
      'Earn badges and become the King of the World',
    );
  });
});

describe('selectCaption blocks', () => {
  it('keeps a three line caption as one block, top to bottom', () => {
    const lines = [
      at('the world', { left: 300, top: 260, width: 480, height: 60 }),
      at('Collect monuments', { left: 150, top: 100, width: 780, height: 60 }),
      at('from around', { left: 250, top: 180, width: 580, height: 60 }),
    ];

    expect(selectCaption(lines, FRAME)).toBe(
      'Collect monuments from around the world',
    );
  });

  it('separates text that does not overlap horizontally and takes the heavier block', () => {
    const lines = [
      at('Plan your week', { left: 40, top: 100, width: 600, height: 80 }),
      at('Tue', { left: 900, top: 110, width: 120, height: 60 }),
    ];

    expect(selectCaption(lines, FRAME)).toBe('Plan your week');
  });

  it('prefers a block outside the device band over an equal one inside it', () => {
    const lines = [
      at('Sleep better', { left: 240, top: 120, width: 600, height: 70 }),
      at('Your sleep score', { left: 240, top: 900, width: 600, height: 70 }),
    ];

    expect(selectCaption(lines, FRAME)).toBe('Sleep better');
  });

  it('still reads a caption that sits alone in the middle of the image', () => {
    const lines = [
      at('Meditate anywhere', { left: 120, top: 880, width: 840, height: 90 }),
    ];

    expect(selectCaption(lines, FRAME)).toBe('Meditate anywhere');
  });

  it('reads a lone interface title under the single line share as no caption', () => {
    const lines = [
      at('Leaderboard', { left: 60, top: 140, width: 420, height: 50 }),
      at('Weekly', { left: 60, top: 260, width: 160, height: 30 }),
    ];

    expect(selectCaption(lines, FRAME)).toBeNull();
  });

  it('reads a single line at the single line share and none just below it', () => {
    const height = 2000;
    const tall = Math.ceil(height * MIN_SINGLE_LINE_SHARE);

    expect(
      selectCaption(
        [at('Explore', { left: 330, top: 120, width: 420, height: tall })],
        height,
      ),
    ).toBe('Explore');
    expect(
      selectCaption(
        [at('Explore', { left: 330, top: 120, width: 420, height: tall - 1 })],
        height,
      ),
    ).toBeNull();
  });

  it('reads a block of several short lines although each is under the single line share', () => {
    const lines = [
      at('Trusted by millions.', {
        left: 140,
        top: 120,
        width: 800,
        height: 50,
      }),
      at('Recommended by experts.', {
        left: 100,
        top: 185,
        width: 880,
        height: 50,
      }),
    ];

    expect(selectCaption(lines, FRAME)).toBe(
      'Trusted by millions. Recommended by experts.',
    );
  });
});

describe('selectCaption rows', () => {
  it('reads the boxes of one row left to right even when the right one sits higher', () => {
    const lines = [
      at('Earn badges and become', {
        left: 90,
        top: 120,
        width: 900,
        height: 80,
      }),
      at('the King', { left: 150, top: 232, width: 300, height: 80 }),
      at('of the World', { left: 470, top: 230, width: 420, height: 80 }),
    ];

    expect(selectCaption(lines, FRAME)).toBe(
      'Earn badges and become the King of the World',
    );
  });

  it('joins a caption the engine split into two boxes side by side', () => {
    const lines = [
      at('Collect monuments', { left: 80, top: 120, width: 520, height: 70 }),
      at('from around the world', {
        left: 640,
        top: 122,
        width: 380,
        height: 70,
      }),
    ];

    expect(selectCaption(lines, FRAME)).toBe(
      'Collect monuments from around the world',
    );
  });

  it('keeps two boxes of one row apart when the gap between them is wide', () => {
    const lines = [
      at('Plan your week', { left: 40, top: 100, width: 600, height: 80 }),
      at('Sunday', { left: 900, top: 104, width: 160, height: 76 }),
    ];

    expect(selectCaption(lines, FRAME)).toBe('Plan your week');
  });

  it('reads a screenshot whose only large text has fewer than three letters as no caption', () => {
    expect(
      selectCaption(
        [at('地図', { left: 400, top: 120, width: 280, height: 140 })],
        FRAME,
      ),
    ).toBeNull();
  });
});
