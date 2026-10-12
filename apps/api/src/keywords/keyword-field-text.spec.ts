import { BadRequestException } from '@nestjs/common';
import { parseFieldText } from './keyword-field-text';

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
});
