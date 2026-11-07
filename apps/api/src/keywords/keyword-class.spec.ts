import { SerpFlag } from '@asobeast/shared';
import { contentWords } from './brand-words';
import {
  BrandProfile,
  CATEGORY_NAME_COMPETITORS,
  ClassifiableKeyword,
  GENERIC_SERP_RELEVANCE,
  brandProfileOf,
  classifyKeyword,
  profileForListing,
} from './keyword-class';

const OWN_LISTING = contentWords(
  'Forest: Stay Focused. Plant a tree and stay off your phone.',
);

const forestProfile = brandProfileOf({
  title: 'Forest: Stay Focused',
  developer: 'Seekrtech Inc.',
  competitorTitles: ['Todoist - To-Do List', 'Focus Timer: Pomodoro'],
});

type KeywordCase = Partial<Omit<ClassifiableKeyword, 'text'>> & {
  listingWords?: readonly string[];
};

const classOf = (
  text: string,
  { listingWords = OWN_LISTING, ...overrides }: KeywordCase = {},
  profile: BrandProfile = forestProfile,
) =>
  classifyKeyword(
    { text, flags: [], serpRelevance: null, ...overrides },
    profileForListing(profile, { words: listingWords, titles: [] }),
  );

const BRAND: SerpFlag[] = ['brand'];

describe('classifyKeyword on the worked examples', () => {
  it.each([
    ['forest', {}, 'ownBrand'],
    ['forest', { serpRelevance: 0.1 }, 'ownBrand'],
    ['forest app', {}, 'ownBrand'],
    ['seekrtech', {}, 'ownBrand'],
    ['todoist', { serpRelevance: 0.1 }, 'competitorBrand'],
    ['todoist alternative', { serpRelevance: 0.1 }, 'competitorBrand'],
    ['focus timer', { serpRelevance: 0.8 }, 'generic'],
    [
      'focus timer',
      { listingWords: contentWords('Forest: a focus timer for you') },
      'generic',
    ],
    ['focus timer', {}, 'competitorBrand'],
    ['geoguessr', { flags: BRAND, serpRelevance: 0.05 }, 'competitorBrand'],
    ['pomodoro timer', { serpRelevance: 0.7 }, 'generic'],
    ['the', {}, 'generic'],
  ] as const)('classifies %j with %j as %s', (text, overrides, expected) => {
    expect(classOf(text, overrides)).toBe(expected);
  });

  it('folds accents against an own name', () => {
    const profile = brandProfileOf({
      title: 'Cafe',
      developer: null,
      competitorTitles: [],
    });
    expect(classOf('café', {}, profile)).toBe('ownBrand');
  });
});

describe('the generic search page threshold', () => {
  it(`keeps a name match below ${GENERIC_SERP_RELEVANCE} and overrules it from it on`, () => {
    expect(classOf('forest', { serpRelevance: 0.49 })).toBe('ownBrand');
    expect(classOf('forest', { serpRelevance: GENERIC_SERP_RELEVANCE })).toBe(
      'generic',
    );
  });

  it('never overrules a name match when the brand flag is raised', () => {
    expect(classOf('forest', { flags: BRAND, serpRelevance: 0.49 })).toBe(
      'ownBrand',
    );
    expect(classOf('forest', { flags: BRAND, serpRelevance: 0.5 })).toBe(
      'ownBrand',
    );
  });

  it('never overrules an unscored keyword', () => {
    expect(classOf('forest', { serpRelevance: null })).toBe('ownBrand');
  });
});

describe('the competitor names', () => {
  const profileOf = (...competitorTitles: string[]) =>
    brandProfileOf({ title: null, developer: null, competitorTitles });

  it('never matches a competitor lead longer than a name', () => {
    expect(
      classOf(
        'alpha beta gamma delta',
        {},
        profileOf('Alpha Beta Gamma Delta: x'),
      ),
    ).toBe('generic');
  });

  it(`drops a name ${CATEGORY_NAME_COMPETITORS} competitors share as a category word`, () => {
    expect(classOf('focus timer', {}, profileOf('Focus Timer: x'))).toBe(
      'competitorBrand',
    );
    expect(
      classOf(
        'focus timer',
        {},
        profileOf('Focus Timer: x', 'Focus Timer - y'),
      ),
    ).toBe('generic');
  });

  it('never reads the brand flag on a category word two competitors share', () => {
    const flagged = { flags: BRAND, serpRelevance: 0.1 };

    expect(
      classOf(
        'focus timer',
        flagged,
        profileOf('Focus Timer: x', 'Focus Timer - y'),
      ),
    ).toBe('generic');
  });

  it('never reads the brand flag on a competitor name the own listing uses', () => {
    expect(classOf('focus timer', { flags: BRAND, serpRelevance: 0.1 })).toBe(
      'competitorBrand',
    );
    expect(
      classOf('focus timer', {
        flags: BRAND,
        serpRelevance: 0.1,
        listingWords: contentWords('a focus timer for study'),
      }),
    ).toBe('generic');
  });

  it('checks the own name before a competitor with the same name', () => {
    const profile = brandProfileOf({
      title: 'Forest: x',
      developer: null,
      competitorTitles: ['Forest: y'],
    });
    expect(classOf('forest', {}, profile)).toBe('ownBrand');
  });
});

describe('how a keyword holds a name', () => {
  const profileOf = (title: string) =>
    brandProfileOf({ title: null, developer: null, competitorTitles: [title] });

  it('asks for the whole name, whatever else the keyword holds', () => {
    expect(classOf('geoguessr world', {}, profileOf('GeoGuessr'))).toBe(
      'competitorBrand',
    );
    expect(
      classOf('weather', {}, profileOf('The Weather Channel: Radar')),
    ).toBe('generic');
    expect(
      classOf(
        'weather channel radar',
        {},
        profileOf('The Weather Channel: Radar'),
      ),
    ).toBe('competitorBrand');
  });

  it('matches plural and inflected forms', () => {
    expect(classOf('forests')).toBe('ownBrand');
  });

  it('folds accents on both sides', () => {
    expect(classOf('café finder', {}, profileOf('Café Finder | Maps'))).toBe(
      'competitorBrand',
    );
  });

  it('finds a spaceless name inside a longer word', () => {
    expect(classOf('微信聊天', {}, profileOf('微信'))).toBe('competitorBrand');
    expect(classOf('聊天', {}, profileOf('微信'))).toBe('generic');
  });

  it('reads a keyword of stopwords or no text as generic', () => {
    expect(classOf('the app')).toBe('generic');
    expect(classOf('')).toBe('generic');
  });

  it('reads every keyword as generic without names or a flag', () => {
    const empty = brandProfileOf({
      title: null,
      developer: null,
      competitorTitles: [],
    });
    expect(classOf('forest', {}, empty)).toBe('generic');
  });
});

describe('brandProfileOf', () => {
  it('answers empty lists for missing titles and developers', () => {
    expect(
      brandProfileOf({
        title: null,
        developer: null,
        competitorTitles: [null, null],
      }),
    ).toEqual({ own: [], competitors: [], categories: [] });
  });
});

describe('profileForListing', () => {
  it('drops the competitor names the own listing already uses and keeps the own names', () => {
    expect(
      profileForListing(forestProfile, {
        words: contentWords('a focus timer app'),
        titles: [],
      }),
    ).toEqual({
      own: forestProfile.own,
      competitors: [new Set(['todoist'])],
      categories: [new Set(['focus', 'timer'])],
    });
  });
});

describe('the market listing title', () => {
  const homeOnly = brandProfileOf({
    title: 'WeChat',
    developer: null,
    competitorTitles: [],
  });

  it('is an own name of the keywords of that market', () => {
    const market = profileForListing(homeOnly, { words: [], titles: ['微信'] });

    expect(
      classifyKeyword(
        { text: '微信', flags: BRAND, serpRelevance: 0.1 },
        market,
      ),
    ).toBe('ownBrand');
    expect(
      classifyKeyword(
        { text: 'wechat', flags: [], serpRelevance: null },
        market,
      ),
    ).toBe('ownBrand');
  });

  it('adds no name for a market without a listing', () => {
    expect(profileForListing(homeOnly, { words: [], titles: [] }).own).toEqual(
      homeOnly.own,
    );
  });
});

describe('category names across plurals', () => {
  it('keeps two spaceless names when one only contains the other', () => {
    const profile = brandProfileOf({
      title: null,
      developer: null,
      competitorTitles: ['微信: x', '微信支付: y'],
    });

    expect(
      classOf('微信支付', { listingWords: contentWords('微信') }, profile),
    ).toBe('competitorBrand');
  });

  it('drops a name two competitors share in singular and plural', () => {
    const profile = brandProfileOf({
      title: null,
      developer: null,
      competitorTitles: ['Focus Timer: x', 'Focus Timers: y'],
    });

    expect(classOf('focus timer', {}, profile)).toBe('generic');
  });
});

describe('a keyword of stopwords only', () => {
  it('reads the brand flag', () => {
    expect(classOf('the app', { flags: BRAND, serpRelevance: 0.1 })).toBe(
      'competitorBrand',
    );
  });

  it('stays generic without the flag', () => {
    expect(classOf('the app', { serpRelevance: 0.1 })).toBe('generic');
  });
});
