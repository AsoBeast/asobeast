import { provenDefaultLocalization } from './market-default-localization';

const shot = (n: number) =>
  `https://is1-ssl.mzstatic.com/image/thumb/a/b/${n}/shot.jpg/392x696bb.jpg`;

const listing = (
  title: string,
  subtitle: string | null,
  description: string,
  screenshots: number[],
) => ({
  title,
  subtitle,
  description,
  raw: { screenshots: screenshots.map(shot) },
});

const ENGLISH = listing(
  'Where Am I? GeoGuess Map Quiz',
  'World Geography Trivia Game',
  'Discover the world',
  [1, 2],
);
const GERMAN = listing(
  'Wo bin ich? Geo Quiz',
  'Welt Geografie Spiel',
  'Entdecke die Welt',
  [5, 6],
);
const FRENCH = listing(
  'Où suis-je ? Quiz Géo',
  'Jeu de géographie',
  'Découvrez le monde',
  [7, 8],
);
const ITALIAN = listing(
  'Dove sono? Quiz Geo',
  'Gioco di geografia',
  'Scopri il mondo',
  [9, 10],
);

describe('provenDefaultLocalization', () => {
  it('answers the market default when the listing differs from the home one', () => {
    expect(
      provenDefaultLocalization({
        home: 'us',
        market: 'de',
        homeListing: ENGLISH,
        listing: GERMAN,
        others: [],
      }),
    ).toBe('de');
  });

  it('answers nothing when the market echoes the home listing', () => {
    expect(
      provenDefaultLocalization({
        home: 'us',
        market: 'de',
        homeListing: ENGLISH,
        listing: ENGLISH,
        others: [],
      }),
    ).toBeNull();
  });

  it('answers nothing for the home localization', () => {
    expect(
      provenDefaultLocalization({
        home: 'de',
        market: 'at',
        homeListing: GERMAN,
        listing: ENGLISH,
        others: [],
      }),
    ).toBeNull();
    expect(
      provenDefaultLocalization({
        home: 'gb',
        market: 'pl',
        homeListing: ENGLISH,
        listing: GERMAN,
        others: [],
      }),
    ).toBeNull();
  });

  it('answers english (u.k.) for a british market only when its text differs', () => {
    const british = { ...ENGLISH, description: 'Discover the world, colour' };

    expect(
      provenDefaultLocalization({
        home: 'us',
        market: 'gb',
        homeListing: ENGLISH,
        listing: british,
        others: [],
      }),
    ).toBe('en-GB');
    expect(
      provenDefaultLocalization({
        home: 'us',
        market: 'gb',
        homeListing: ENGLISH,
        listing: ENGLISH,
        others: [],
      }),
    ).toBeNull();
  });

  it('answers nothing when an additional localization of the market echoes the listing', () => {
    expect(
      provenDefaultLocalization({
        home: 'us',
        market: 'ch',
        homeListing: ENGLISH,
        listing: FRENCH,
        others: [FRENCH],
      }),
    ).toBeNull();
    expect(
      provenDefaultLocalization({
        home: 'us',
        market: 'ch',
        homeListing: ENGLISH,
        listing: FRENCH,
        others: [ITALIAN],
      }),
    ).toBe('de');
  });

  it('reads a subtitle difference alone as proof', () => {
    const subtitled = { ...ENGLISH, subtitle: 'Erdkunde Trivia' };

    expect(
      provenDefaultLocalization({
        home: 'us',
        market: 'de',
        homeListing: ENGLISH,
        listing: subtitled,
        others: [],
      }),
    ).toBe('de');
    expect(
      provenDefaultLocalization({
        home: 'us',
        market: 'de',
        homeListing: { ...ENGLISH, subtitle: undefined },
        listing: subtitled,
        others: [],
      }),
    ).toBeNull();
  });

  it('answers nothing for a code that is no storefront', () => {
    expect(
      provenDefaultLocalization({
        home: 'us',
        market: 'xx',
        homeListing: ENGLISH,
        listing: GERMAN,
        others: [],
      }),
    ).toBeNull();
  });
});
