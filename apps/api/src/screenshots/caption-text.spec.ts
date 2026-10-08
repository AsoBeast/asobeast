import {
  CAPTION_HEIGHT_RATIO,
  joinSpacelessRuns,
  MAX_CAPTION_CHARS,
  MIN_LINE_CONFIDENCE,
  OcrLine,
  selectCaption,
} from './caption-text';

const IMAGE_HEIGHT = 2341;

const line = (
  text: string,
  height: number,
  top: number,
  confidence = 96,
): OcrLine => ({ text, height, top, confidence });

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
    const lines = [line('second line', 100, 400), line('first line', 100, 100)];

    expect(selectCaption(lines, IMAGE_HEIGHT)).toBe('first line second line');
  });

  it('keeps a line that is nearly as tall as the tallest', () => {
    const tallest = 100;
    const lines = [
      line('big', tallest, 100),
      line('kept', tallest * CAPTION_HEIGHT_RATIO + 1, 300),
      line('dropped', tallest * CAPTION_HEIGHT_RATIO - 1, 500),
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
