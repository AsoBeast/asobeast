import {
  type AppLocalizationOrigin,
  KEYWORD_FIELD_CHAR_LIMIT,
} from '@asobeast/shared';
import { marketReads } from './market-keyword-fields';

const none = new Map<string, readonly string[]>();
const nothingShipped = new Map<string, AppLocalizationOrigin>();

describe('marketReads', () => {
  it('lists every localization the market reads in read order, the first as default', () => {
    const reads = marketReads({
      country: 'mx',
      home: 'us',
      shipped: nothingShipped,
      fields: none,
    });

    expect(reads.map(({ localization, role }) => [localization, role])).toEqual(
      [
        ['es-MX', 'default'],
        ['en-GB', 'additional'],
      ],
    );
  });

  it('marks a localization the app does not ship as unshipped, with no origin and an empty field', () => {
    const [read] = marketReads({
      country: 'mx',
      home: 'us',
      shipped: nothingShipped,
      fields: none,
    });

    expect(read).toEqual({
      localization: 'es-MX',
      role: 'default',
      shipped: false,
      origin: null,
      phrases: [],
      charactersUsed: 0,
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
    });
  });

  it('carries the origin and the phrases of a shipped localization', () => {
    const [read] = marketReads({
      country: 'mx',
      home: 'us',
      shipped: new Map([['es-MX', 'detected' as const]]),
      fields: new Map([['es-MX', ['uno', 'dos']]]),
    });

    expect(read).toMatchObject({
      shipped: true,
      origin: 'detected',
      phrases: ['uno', 'dos'],
      charactersUsed: 7,
    });
  });

  it('counts the characters of the field the way the save does', () => {
    const [read] = marketReads({
      country: 'us',
      home: 'us',
      shipped: new Map([['en-US', 'home' as const]]),
      fields: new Map([['en-US', ['é', 'ab']]]),
    });

    expect(read.charactersUsed).toBe(4);
  });

  it('treats the home localization as shipped even when the map lacks it', () => {
    const [read] = marketReads({
      country: 'us',
      home: 'us',
      shipped: nothingShipped,
      fields: none,
    });

    expect(read).toMatchObject({
      localization: 'en-US',
      shipped: true,
      origin: 'home',
    });
  });

  it('reads only English (U.K.) for a country that is no storefront', () => {
    expect(
      marketReads({
        country: 'zz',
        home: 'zz',
        shipped: nothingShipped,
        fields: none,
      }),
    ).toEqual([
      expect.objectContaining({
        localization: 'en-GB',
        role: 'default',
        shipped: true,
        origin: 'home',
      }),
    ]);
  });

  it('does not report a shipped localization the market does not read', () => {
    const reads = marketReads({
      country: 'gb',
      home: 'us',
      shipped: new Map([['es-MX', 'manual' as const]]),
      fields: new Map([['es-MX', ['uno']]]),
    });

    expect(reads.map(({ localization }) => localization)).toEqual(['en-GB']);
  });
});
