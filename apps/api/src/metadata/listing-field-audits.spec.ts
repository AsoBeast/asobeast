import { Store } from '@prisma/client';
import {
  lintContextOf,
  listingFieldAudits,
  ListingFieldTexts,
} from './listing-field-audits';

const texts = (
  overrides: Partial<ListingFieldTexts> = {},
): ListingFieldTexts => ({
  title: 'Focus Timer',
  subtitle: 'Daily goals',
  summary: null,
  description: 'Plan your day.',
  keywordField: '',
  ...overrides,
});

const auditOf = (store: Store, overrides: Partial<ListingFieldTexts> = {}) => {
  const fieldTexts = texts(overrides);
  return listingFieldAudits(
    store,
    fieldTexts,
    lintContextOf(fieldTexts, {
      appName: 'Focus Timer',
      competitorNames: [],
      trackedKeywords: [],
    }),
  );
};

describe('listingFieldAudits on the App Store', () => {
  it('lints title, subtitle and description and counts code points', () => {
    const fields = auditOf(Store.APP_STORE, { title: 'Focus ⏱ Timer' });

    expect(fields.map((field) => field.field)).toEqual([
      'title',
      'subtitle',
      'description',
    ]);
    expect(fields[0]).toMatchObject({
      value: 'Focus ⏱ Timer',
      chars: 13,
      limit: 30,
      indexed: true,
    });
  });

  it('adds the keyword field only when it holds text', () => {
    expect(
      auditOf(Store.APP_STORE).some((field) => field.field === 'keywordField'),
    ).toBe(false);

    const field = auditOf(Store.APP_STORE, {
      keywordField: 'planner,goals',
    }).find((entry) => entry.field === 'keywordField');

    expect(field).toMatchObject({
      value: 'planner,goals',
      chars: 13,
      limit: 100,
      indexed: true,
    });
    expect(field?.issues.map((issue) => issue.rule)).toContain(
      'under-utilized',
    );
  });

  it('flags a keyword field word that repeats the title', () => {
    const field = auditOf(Store.APP_STORE, {
      keywordField: 'focus,planner',
    }).find((entry) => entry.field === 'keywordField');

    expect(field?.issues.map((issue) => issue.rule)).toContain(
      'repeats-title-word',
    );
  });

  it('marks the description as not indexed', () => {
    const description = auditOf(Store.APP_STORE).find(
      (field) => field.field === 'description',
    );

    expect(description).toMatchObject({ limit: 4000, indexed: false });
  });
});

describe('listingFieldAudits on Google Play', () => {
  it('lints title, short description and description', () => {
    const fields = auditOf(Store.GOOGLE_PLAY, { summary: 'Plan your focus' });

    expect(fields.map((field) => field.field)).toEqual([
      'title',
      'shortDescription',
      'description',
    ]);
    expect(fields[1]).toMatchObject({ value: 'Plan your focus', limit: 80 });
    expect(fields[2]).toMatchObject({ limit: 4000, indexed: true });
  });

  it('never answers a subtitle or keyword field', () => {
    const fields = auditOf(Store.GOOGLE_PLAY, { keywordField: 'timer,focus' });

    expect(
      fields.some(
        (field) => field.field === 'subtitle' || field.field === 'keywordField',
      ),
    ).toBe(false);
  });
});

describe('lintContextOf', () => {
  it('reads title and subtitle words, brand tokens, competitor names and tracked keywords', () => {
    expect(
      lintContextOf(
        { title: 'Focus Timer', subtitle: 'Daily goals' },
        {
          appName: 'Focus Timer',
          competitorNames: ['Forest'],
          trackedKeywords: ['habit tracker'],
        },
      ),
    ).toEqual({
      titleWords: ['focus', 'timer'],
      subtitleWords: ['daily', 'goals'],
      brandTokens: ['focus', 'timer'],
      competitorNames: ['Forest'],
      trackedKeywords: ['habit tracker'],
    });
  });

  it('reads no words from a missing subtitle or app name', () => {
    expect(
      lintContextOf(
        { title: '', subtitle: null },
        { appName: null, competitorNames: [], trackedKeywords: [] },
      ),
    ).toMatchObject({ titleWords: [], subtitleWords: [], brandTokens: [] });
  });
});
