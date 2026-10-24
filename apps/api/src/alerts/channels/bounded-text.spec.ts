import { boundedLines, clamp, shortenLine } from './bounded-text';

describe('clamp', () => {
  it('keeps a short text and cuts a long one with an ellipsis', () => {
    expect(clamp('abc', 5)).toBe('abc');
    expect(clamp('abcdef', 5)).toBe('abcd…');
  });
});

describe('shortenLine', () => {
  it('says how many characters it left out and stays within the bound', () => {
    const line = shortenLine('x'.repeat(100), 40);

    expect(line.length).toBeLessThanOrEqual(40);
    expect(line).toMatch(/… \(\+\d+ chars omitted\)$/);
  });

  it('keeps a line that fits', () => {
    expect(shortenLine('fits', 10)).toBe('fits');
  });
});

describe('boundedLines', () => {
  it('joins lines that fit', () => {
    expect(boundedLines(['a', 'b'], 10)).toBe('a\nb');
  });

  it('counts the lines it could not fit', () => {
    const text = boundedLines(['aaaa', 'bbbb', 'cccc', 'dddd'], 17);

    expect(text).toBe('aaaa\nbbbb\n+2 more');
    expect(text.length).toBeLessThanOrEqual(17);
  });

  it('shortens a first line that alone passes the bound', () => {
    const text = boundedLines(['x'.repeat(50), 'tail'], 40);

    expect(text.length).toBeLessThanOrEqual(40);
    expect(text.endsWith('\n+1 more')).toBe(true);
  });

  it('prints nothing for no lines', () => {
    expect(boundedLines([], 10)).toBe('');
  });
});
