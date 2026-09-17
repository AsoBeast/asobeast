import {
  appStoreContext,
  keyword,
  playContext,
} from '../audit-context.fixture';
import {
  keywordFieldChecks,
  shortDescriptionChecks,
  subtitleChecks,
  titleChecks,
} from './metadata-checks';

const priority = [
  keyword('geo quiz', 'primary', 80),
  keyword('map game', 'secondary', 60),
];

const checkOf = (
  checks: ReturnType<typeof shortDescriptionChecks>,
  id: string,
) => checks.find((item) => item.id === id);

describe('shortDescriptionChecks', () => {
  it.each([
    ['', 0],
    ['x'.repeat(59), 6.9],
    ['x'.repeat(60), 7],
    ['x'.repeat(76), 7],
    ['x'.repeat(77), 10],
    ['x'.repeat(80), 10],
  ])(
    'scores a short description of %s characters on length',
    (summary, score) => {
      const checks = shortDescriptionChecks(
        playContext({ summary, keywords: priority }),
      );

      expect(checkOf(checks, 'short-description-length')?.score).toBe(score);
    },
  );

  it('names the priority keyword to add', () => {
    const checks = shortDescriptionChecks(
      playContext({
        summary: 'Travel the world from your sofa every day',
        keywords: priority,
      }),
    );
    const coverage = checkOf(checks, 'short-description-keyword');

    expect(coverage?.score).toBe(0);
    expect(coverage?.advice?.title).toBe(
      'Add “geo quiz” to your short description',
    );
  });

  it('fails a short description with a call to action', () => {
    const checks = shortDescriptionChecks(
      playContext({
        summary: 'Download now, the best geo quiz',
        keywords: priority,
      }),
    );

    expect(checkOf(checks, 'short-description-policy')?.status).toBe('fail');
  });

  it('scores a short description that covers two priority keywords', () => {
    const checks = shortDescriptionChecks(
      playContext({
        summary: 'A geo quiz and map game for curious travellers',
        keywords: priority,
      }),
    );

    expect(checkOf(checks, 'short-description-keyword')?.score).toBe(10);
  });

  it('waits for tracked keywords instead of scoring coverage', () => {
    const checks = shortDescriptionChecks(
      playContext({ summary: 'Travel the world from your sofa every day' }),
    );

    expect(checkOf(checks, 'short-description-keyword')).toMatchObject({
      score: null,
      status: 'unanswered',
      unlock: { kind: 'keywords' },
    });
  });

  it('omits the repetition and policy checks for an empty short description', () => {
    const ids = shortDescriptionChecks(playContext({ summary: '' })).map(
      (item) => item.id,
    );

    expect(ids).toEqual([
      'short-description-keyword',
      'short-description-length',
    ]);
  });
});

const titleKeywords = [
  keyword('geo quiz', 'primary', 90),
  keyword('geography game', 'primary', 70),
  keyword('world map', 'secondary', 50),
];

const titleCheck = (context: Parameters<typeof titleChecks>[0], id: string) =>
  titleChecks(context).find((item) => item.id === id);

describe('titleChecks', () => {
  it('names the primary keyword it found', () => {
    expect(
      titleCheck(
        appStoreContext({
          title: 'Where Am I? Geo Quiz',
          keywords: titleKeywords,
        }),
        'title-keyword',
      ),
    ).toMatchObject({
      score: 10,
      detail: 'The title contains \u201cgeo quiz\u201d, a primary keyword.',
    });
  });

  it('names the primary keywords it missed, and advises the strongest', () => {
    expect(
      titleCheck(
        appStoreContext({ title: 'Where Am I?', keywords: titleKeywords }),
        'title-keyword',
      ),
    ).toMatchObject({
      score: 0,
      detail:
        'None of your primary keywords appear in the title: \u201cgeo quiz\u201d, \u201cgeography game\u201d.',
      advice: { title: 'Put \u201cgeo quiz\u201d in your title' },
    });
  });

  it.each([
    [99_999, 0],
    [100_000, 4],
    [999_999, 4],
    [1_000_000, 8],
  ])('scores a brand led title with %i ratings as %i', (ratingCount, score) => {
    expect(
      titleCheck(
        appStoreContext({
          title: 'LinkedIn',
          ratingCount,
          keywords: titleKeywords,
        }),
        'title-keyword',
      )?.score,
    ).toBe(score);
  });

  it('waits for scored keywords instead of guessing a primary keyword', () => {
    expect(
      titleCheck(appStoreContext({ title: 'Where Am I?' }), 'title-keyword'),
    ).toMatchObject({
      score: null,
      status: 'unanswered',
      unlock: { kind: 'keywords' },
    });
  });

  it('does not pass uniqueness without competitors', () => {
    expect(
      titleCheck(
        appStoreContext({ title: 'Where Am I? Geo Quiz' }),
        'title-uniqueness',
      ),
    ).toMatchObject({
      score: null,
      status: 'unanswered',
      unlock: {
        kind: 'competitors',
        label: 'Add competitors to compare titles',
      },
    });
  });

  it('proposes the best uncovered keyword that still fits the unused characters', () => {
    expect(
      titleCheck(
        appStoreContext({
          title: 'Where Am I? Quiz',
          keywords: titleKeywords,
        }),
        'title-length',
      )?.advice?.fix,
    ).toBe(
      'Add \u201cgeo quiz\u201d (8 characters), your best uncovered keyword that still fits.',
    );
  });

  it('gives no length advice to a title that uses 27 characters', () => {
    expect(
      titleCheck(
        appStoreContext({
          title: 'Where Am I? Map Quiz Trivia',
          keywords: titleKeywords,
        }),
        'title-length',
      )?.advice,
    ).toBeNull();
  });

  it('flags a Google Play claim in the title', () => {
    const check = titleChecks(
      playContext({ title: 'Best Geo Quiz Game', keywords: titleKeywords }),
    ).find((item) => item.id === 'title-policy');

    expect(check?.status).toBe('warn');
    expect(check?.advice?.title).toBe(
      'Remove \u201cbest\u201d from your title',
    );
  });
});

describe('subtitleChecks', () => {
  it('scores two priority keywords outside the title as full marks', () => {
    const checks = subtitleChecks(
      appStoreContext({
        title: 'Where Am I?',
        subtitle: 'Geo quiz and world map',
        keywords: titleKeywords,
      }),
    );

    expect(checks.find((item) => item.id === 'subtitle-keyword')?.score).toBe(
      10,
    );
  });

  it('advises writing a subtitle when it is empty, and omits repetition', () => {
    const checks = subtitleChecks(
      appStoreContext({ title: 'Where Am I?', keywords: titleKeywords }),
    );

    expect(checks.map((item) => item.id)).toEqual([
      'subtitle-keyword',
      'subtitle-length',
    ]);
    expect(
      checks.find((item) => item.id === 'subtitle-length')?.advice?.title,
    ).toBe('Add a subtitle');
  });

  it('flags a subtitle word already indexed from the title', () => {
    const checks = subtitleChecks(
      appStoreContext({
        title: 'Geo Quiz',
        subtitle: 'Geo trivia for travellers',
        keywords: titleKeywords,
      }),
    );

    expect(
      checks.find((item) => item.id === 'subtitle-no-repetition')?.advice
        ?.title,
    ).toBe('Replace \u201cgeo\u201d in your subtitle');
  });
});

describe('keywordFieldChecks', () => {
  it('fails a Polish field that fits 100 characters but not 100 bytes', () => {
    const field =
      'zażółć,gęślą,jaźń,łódź,źrebię,ćma,żółw,świeca,mąka,ślimak,pączek,żaba,źdźbło,ćwierć';
    const checks = keywordFieldChecks(appStoreContext({ keywordField: field }));

    expect(
      checks.find((item) => item.id === 'keyword-field-bytes'),
    ).toMatchObject({
      score: 0,
      advice: { title: 'Cut your keyword field to 100 bytes' },
    });
  });

  it('flags the company name', () => {
    const checks = keywordFieldChecks(
      appStoreContext({
        keywordField: 'quiz,anthropic,map',
        facts: { developerName: 'Anthropic PBC' },
      }),
    );

    expect(
      checks.find((item) => item.id === 'keyword-field-hygiene')?.advice?.title,
    ).toBe('Remove \u201canthropic\u201d from your keyword field');
  });

  it.each([
    [89, 9.9],
    [90, 10],
    [100, 10],
    [101, 0],
  ])('scores a field of %i bytes as %s', (bytes, score) => {
    const checks = keywordFieldChecks(
      appStoreContext({ keywordField: 'a'.repeat(bytes) }),
    );

    expect(
      checks.find((item) => item.id === 'keyword-field-bytes')?.score,
    ).toBe(score);
  });

  it('waits for a saved keyword field', () => {
    expect(
      keywordFieldChecks(appStoreContext()).map((item) => item.id),
    ).toEqual(['keyword-field-saved']);
  });
});
