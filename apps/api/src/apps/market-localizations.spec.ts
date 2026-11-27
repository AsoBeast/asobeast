import { Store } from '@prisma/client';
import {
  capturedLocalizations,
  homeDefaultProbes,
} from './market-localizations';

describe('capturedLocalizations', () => {
  it.each([
    ['ch', ['fr', 'it', 'de', 'ja'], ['fr', 'it']],
    ['pl', ['pl', 'de'], ['pl']],
    ['pl', [], ['pl']],
    ['es', ['ca'], ['ca']],
    ['ru', ['uk'], ['uk']],
    ['us', ['es-MX'], ['es-MX']],
    ['de', [], []],
    ['de', ['xx', 'de'], []],
    ['zz', ['fr'], []],
  ])(
    'captures in %s shipping %j the localizations %j',
    (market, shipped, expected) => {
      expect(capturedLocalizations(market, shipped)).toEqual(expected);
    },
  );

  it('keeps the read order of the storefront', () => {
    expect(capturedLocalizations('ch', ['it', 'en-GB', 'fr'])).toEqual([
      'en-GB',
      'fr',
      'it',
    ]);
  });
});

describe('homeDefaultProbes', () => {
  const APP = { store: Store.APP_STORE, country: 'de', isCompetitor: false };
  const english = {
    description:
      'The diary is an app for students and their parents. Check your grades, attendance and timetable in one place. Get a notice about new grades and about messages from your teachers. The app works with the school register and is open to every school that uses the system.',
    raw: { languages: ['EN'] },
  };
  const german = {
    description:
      'Das Tagebuch ist eine App für Schüler und ihre Eltern. Sieh dir deine Noten, die Anwesenheit und den Stundenplan an einem Ort an. Die App arbeitet mit dem Klassenbuch der Schule und ist für jede Schule offen, die das System nutzt.',
    raw: { languages: ['DE', 'EN'] },
  };

  it('probes english (u.k.) for an english listing at home in germany', () => {
    expect(homeDefaultProbes(APP, 'de', english)).toEqual(['en-GB']);
  });

  it.each([
    ['a market capture', APP, 'fr', english],
    ['a competitor', { ...APP, isCompetitor: true }, 'de', english],
    ['a google play app', { ...APP, store: Store.GOOGLE_PLAY }, 'de', english],
    ['a german listing', APP, 'de', german],
  ])('probes nothing for %s', (_case, app, market, listing) => {
    expect(homeDefaultProbes(app, market, listing)).toEqual([]);
  });
});
