import { BadRequestException } from '@nestjs/common';
import { parseFieldText } from './keyword-field-text';

const STEM = [0x20bb7, 0x91ce, 0x5bb6];

const astralPhrase = (index: number): string =>
  String.fromCodePoint(...STEM, 0x20000 + index, 0x2a6a5, 0x2a6a5);

const astralField = (lastPhraseCharacters: number): string =>
  [
    ...Array.from({ length: 14 }, (_, index) => astralPhrase(index)),
    String.fromCodePoint(...STEM.slice(0, lastPhraseCharacters)),
  ].join(',');

describe('parseFieldText', () => {
  it('splits on commas, normalizes and removes duplicates, counting them', () => {
    expect(parseFieldText(' Habit , goals,habit ,, ')).toEqual({
      phrases: ['habit', 'goals'],
      duplicatesRemoved: 1,
    });
  });

  it('refuses a field over 100 characters with the message the old route gives', () => {
    const text = Array.from(
      { length: 12 },
      (_, index) => `phrase ${index}`,
    ).join(',');

    expect(() => parseFieldText(text)).toThrow(
      new BadRequestException('Keyword field exceeds 100 characters'),
    );
  });

  it('refuses a phrase over five words', () => {
    expect(() => parseFieldText('one two three four five six')).toThrow(
      BadRequestException,
    );
  });

  it('accepts a field of exactly 100 characters that holds characters outside the bmp', () => {
    expect(parseFieldText(astralField(2)).phrases).toHaveLength(15);
  });

  it('refuses a field of 101 characters that holds characters outside the bmp', () => {
    expect(() => parseFieldText(astralField(3))).toThrow(
      new BadRequestException('Keyword field exceeds 100 characters'),
    );
  });
});
