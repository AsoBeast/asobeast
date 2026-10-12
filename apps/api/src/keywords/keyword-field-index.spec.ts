import { KeywordSource } from '@prisma/client';
import { indexKeywordFields, reportedSource } from './keyword-field-index';

describe('indexKeywordFields', () => {
  const fields = [
    { localization: 'en-US', phrases: ['habit'] },
    { localization: 'es-MX', phrases: ['habito'] },
    { localization: 'de', phrases: ['gewohnheit'] },
  ];
  const index = indexKeywordFields(fields);

  it.each([
    ['us', 'habit', true],
    ['us', 'habito', true],
    ['mx', 'habito', true],
    ['jp', 'habit', true],
    ['at', 'gewohnheit', true],
    ['ch', 'gewohnheit', true],
    ['gb', 'habit', false],
    ['us', 'gewohnheit', false],
  ] as const)(
    'a %s keyword %s is in a field: %s',
    (country, text, expected) => {
      expect(index(country, text)).toBe(expected);
    },
  );
});

describe('reportedSource', () => {
  it('reports a member as the keyword field whatever else tracks it', () => {
    expect(reportedSource(KeywordSource.MANUAL, true)).toBe(
      KeywordSource.KEYWORD_FIELD,
    );
    expect(reportedSource(KeywordSource.MANUAL, false)).toBe(
      KeywordSource.MANUAL,
    );
  });
});
