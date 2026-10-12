import { ListingCopy, pickLocalized } from './keyword-breakdown.listings';

const copy = (title: string): ListingCopy => ({ title, subtitle: null });

describe('pickLocalized', () => {
  it('prefers the localization captured in the market itself', () => {
    const read = pickLocalized(
      'pl',
      new Map([['pl', copy('Minutnik')]]),
      new Map([['gb', copy('Timer')]]),
    );

    expect(read.listings).toEqual([
      {
        title: 'Minutnik',
        subtitle: null,
        localization: 'pl',
        sourceCountry: 'pl',
      },
    ]);
    expect(read.unread).toEqual([]);
  });

  it('borrows the default listing of a market that leads with the localization', () => {
    const read = pickLocalized(
      'de',
      new Map(),
      new Map([
        ['de', copy('Fokus Timer')],
        ['gb', copy('Focus Timer')],
      ]),
    );

    expect(read.listings).toEqual([
      {
        title: 'Focus Timer',
        subtitle: null,
        localization: 'en-GB',
        sourceCountry: 'gb',
      },
    ]);
  });

  it('names the localizations nothing was captured for', () => {
    const read = pickLocalized(
      'us',
      new Map(),
      new Map([
        ['us', copy('Focus Timer')],
        ['mx', copy('Temporizador')],
      ]),
    );

    expect(read.listings.map((entry) => entry.localization)).toEqual(['es-MX']);
    expect(read.unread).toEqual([
      'ar',
      'zh-Hans',
      'zh-Hant',
      'fr',
      'ko',
      'pt-BR',
      'ru',
      'vi',
    ]);
  });

  it('reads nothing more in a market with one localization', () => {
    expect(pickLocalized('gb', new Map(), new Map())).toEqual({
      listings: [],
      unread: [],
    });
  });
});
