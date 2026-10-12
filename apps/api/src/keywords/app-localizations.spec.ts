import { toAppLocalizationItems } from './app-localizations';

const input = (
  overrides: Partial<Parameters<typeof toAppLocalizationItems>[0]> = {},
) => ({
  home: 'us',
  markets: ['us'],
  stored: [],
  fields: [],
  ...overrides,
});

const savedAt = new Date('2026-10-10T08:00:00.000Z');

const tags = (items: { localization: string }[]) =>
  items.map((item) => item.localization);

describe('toAppLocalizationItems', () => {
  it('always lists the home localization first, as home, even with no stored data', () => {
    expect(toAppLocalizationItems(input())).toEqual([
      {
        localization: 'en-US',
        origin: 'home',
        phrases: [],
        charactersUsed: 0,
        charactersLimit: 100,
        readBy: [{ country: 'us', role: 'default', home: true }],
        updatedAt: null,
      },
    ]);
  });

  it('treats English (U.K.) as the home localization of a country that is no storefront', () => {
    expect(
      toAppLocalizationItems(input({ home: 'uk', markets: ['uk'] })),
    ).toEqual([
      expect.objectContaining({
        localization: 'en-GB',
        origin: 'home',
        readBy: [{ country: 'uk', role: 'default', home: true }],
      }),
    ]);
  });

  it('reports the home origin although a row is stored for the home localization', () => {
    const items = toAppLocalizationItems(
      input({ stored: [{ localization: 'en-US', origin: 'manual' }] }),
    );

    expect(items).toHaveLength(1);
    expect(items[0].origin).toBe('home');
  });

  it('adds a stored row with its origin and an empty field', () => {
    const items = toAppLocalizationItems(
      input({ stored: [{ localization: 'es-MX', origin: 'detected' }] }),
    );

    expect(items[1]).toMatchObject({
      localization: 'es-MX',
      origin: 'detected',
      phrases: [],
      updatedAt: null,
    });
  });

  it('adds a localization that only has a saved field as manual', () => {
    const items = toAppLocalizationItems(
      input({
        fields: [
          { localization: 'fr', phrases: ['habitude'], updatedAt: savedAt },
        ],
      }),
    );

    expect(items[1]).toMatchObject({ localization: 'fr', origin: 'manual' });
  });

  it('carries the phrases, the characters used and the save time of the field', () => {
    const [home] = toAppLocalizationItems(
      input({
        fields: [
          {
            localization: 'en-US',
            phrases: ['habit', 'goals'],
            updatedAt: savedAt,
          },
        ],
      }),
    );

    expect(home).toMatchObject({
      phrases: ['habit', 'goals'],
      charactersUsed: 11,
      charactersLimit: 100,
      updatedAt: '2026-10-10T08:00:00.000Z',
    });
  });

  it('orders the others by display name after the home localization', () => {
    const items = toAppLocalizationItems(
      input({
        stored: ['es-MX', 'fr', 'pt-BR', 'ar'].map((localization) => ({
          localization,
          origin: 'manual',
        })),
      }),
    );

    expect(tags(items)).toEqual(['en-US', 'ar', 'fr', 'pt-BR', 'es-MX']);
  });

  it('drops a tag that is not an App Store localization', () => {
    const items = toAppLocalizationItems(
      input({
        stored: [{ localization: 'xx', origin: 'manual' }],
        fields: [{ localization: 'de-DE', phrases: ['a'], updatedAt: savedAt }],
      }),
    );

    expect(tags(items)).toEqual(['en-US']);
  });

  it('attaches the markets that read each localization', () => {
    const items = toAppLocalizationItems(
      input({
        markets: ['us', 'de', 'mx'],
        stored: [
          { localization: 'es-MX', origin: 'manual' },
          { localization: 'en-GB', origin: 'manual' },
        ],
      }),
    );
    const readers = Object.fromEntries(
      items.map((item) => [item.localization, item.readBy]),
    );

    expect(readers['es-MX']).toEqual([
      { country: 'us', role: 'additional', home: true },
      { country: 'mx', role: 'default', home: false },
    ]);
    expect(readers['en-GB']).toEqual([
      { country: 'de', role: 'additional', home: false },
      { country: 'mx', role: 'additional', home: false },
    ]);
  });

  it('reads an unknown stored origin as manual', () => {
    const items = toAppLocalizationItems(
      input({ stored: [{ localization: 'fr', origin: 'imported' }] }),
    );

    expect(items[1].origin).toBe('manual');
  });

  it('lists a localization once when it has a row and a field', () => {
    const items = toAppLocalizationItems(
      input({
        stored: [{ localization: 'es-MX', origin: 'detected' }],
        fields: [
          { localization: 'es-MX', phrases: ['habito'], updatedAt: savedAt },
        ],
      }),
    );

    expect(tags(items)).toEqual(['en-US', 'es-MX']);
    expect(items[1]).toMatchObject({ origin: 'detected', phrases: ['habito'] });
  });
});
