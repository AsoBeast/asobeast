import { judgeFields } from './localized-coverage';

const english = [
  { field: 'title' as const, value: 'Where Am I? GeoGuess Map Quiz' },
  { field: 'subtitle' as const, value: 'World Geography Trivia Game' },
];
const polish = {
  localization: 'pl',
  surfaces: [
    { field: 'title' as const, value: 'Where Am I? Quiz Geograficzny' },
    { field: 'subtitle' as const, value: 'Mapa Świata: Zgadnij Kraj' },
  ],
};

describe('judgeFields', () => {
  it('covers a field through a localization and names it', () => {
    expect(judgeFields('quiz geograficzny', english, [polish])).toEqual([
      { field: 'title', covered: true, localization: 'pl' },
      { field: 'subtitle', covered: false },
    ]);
  });

  it('never combines words across localizations or fields', () => {
    expect(judgeFields('geoguess świata', english, [polish])).toEqual([
      { field: 'title', covered: false },
      { field: 'subtitle', covered: false },
    ]);
  });

  it('prefers the default listing and adds no localization key', () => {
    expect(judgeFields('map quiz', english, [polish])).toEqual([
      { field: 'title', covered: true },
      { field: 'subtitle', covered: false },
    ]);
  });

  it('takes the first localization that covers a field', () => {
    const french = {
      localization: 'fr',
      surfaces: [{ field: 'title' as const, value: 'Quiz Geograficzny Monde' }],
    };

    expect(
      judgeFields('quiz geograficzny', english, [french, polish])[0],
    ).toEqual({ field: 'title', covered: true, localization: 'fr' });
  });

  it('never covers the keyword field through a localization', () => {
    const withField = [
      ...english,
      { field: 'keywordField' as const, value: 'atlas' },
    ];
    const withLocalizedField = {
      localization: 'pl',
      surfaces: [
        ...polish.surfaces,
        { field: 'keywordField' as const, value: 'quiz geograficzny' },
      ],
    };

    expect(
      judgeFields('quiz geograficzny', withField, [withLocalizedField])[2],
    ).toEqual({ field: 'keywordField', covered: false });
  });
});
