import { KeywordSource } from '@prisma/client';
import { indexKeywordFields, reportedSource } from './keyword-field-index';

describe('indexKeywordFields', () => {
  const fields = [{ localization: 'en-US', phrases: ['habit', 'streak'] }];

  it('holds the phrases of the home default localization in the home market', () => {
    const index = indexKeywordFields('us', fields);

    expect(index('us', 'habit')).toBe(true);
    expect(index('us', 'goals')).toBe(false);
  });

  it('holds nothing outside the home market', () => {
    expect(indexKeywordFields('us', fields)('jp', 'habit')).toBe(false);
  });

  it('ignores a field of another localization', () => {
    expect(
      indexKeywordFields('us', [{ localization: 'es-MX', phrases: ['habit'] }])(
        'us',
        'habit',
      ),
    ).toBe(false);
  });
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
