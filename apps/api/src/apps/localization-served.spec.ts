import { Store } from '@prisma/client';
import { servesLocalization } from './localization-served';

const shot = (n: number) =>
  `https://is1-ssl.mzstatic.com/image/thumb/a/b/${n}/shot.jpg/392x696bb.jpg`;

const english = {
  title: 'Where Am I? GeoGuess Map Quiz',
  subtitle: 'World Geography Trivia Game',
  description: 'Discover the world',
  raw: { screenshots: [shot(1), shot(2)], releaseNotes: 'New maps' },
};

describe('servesLocalization', () => {
  it('serves a localization whose text differs', () => {
    expect(
      servesLocalization(Store.APP_STORE, english, {
        ...english,
        title: 'Where Am I? Quiz Geograficzny',
      }),
    ).toBe(true);
  });

  it('serves a localization that differs only in its screenshots', () => {
    expect(
      servesLocalization(Store.APP_STORE, english, {
        ...english,
        raw: { ...english.raw, screenshots: [shot(3), shot(4)] },
      }),
    ).toBe(true);
  });

  it('serves a localization that differs only in its subtitle or release notes', () => {
    expect(
      servesLocalization(Store.APP_STORE, english, {
        ...english,
        subtitle: 'Mapa Świata',
      }),
    ).toBe(true);
    expect(
      servesLocalization(Store.APP_STORE, english, {
        ...english,
        raw: { ...english.raw, releaseNotes: 'Nowe mapy' },
      }),
    ).toBe(true);
  });

  it('serves nothing when the store echoes the default listing', () => {
    expect(servesLocalization(Store.APP_STORE, english, { ...english })).toBe(
      false,
    );
  });

  it('treats a missing subtitle like an empty one', () => {
    expect(
      servesLocalization(
        Store.APP_STORE,
        { ...english, subtitle: null },
        { ...english, subtitle: undefined },
      ),
    ).toBe(false);
  });

  it('ignores the translated category the store shows in place of a missing subtitle', () => {
    const untitled = {
      ...english,
      subtitle: 'Social Networking',
      raw: { ...english.raw, genres: ['Social Networking', 'Lifestyle'] },
    };

    expect(
      servesLocalization(Store.APP_STORE, untitled, {
        ...untitled,
        subtitle: 'Sieci społecznościowe',
        raw: {
          ...untitled.raw,
          genres: ['Sieci społecznościowe', 'Styl życia'],
        },
      }),
    ).toBe(false);
    expect(
      servesLocalization(Store.APP_STORE, untitled, {
        ...untitled,
        subtitle: 'Sieci społecznościowe',
        description: 'Odkrywaj świat',
        raw: {
          ...untitled.raw,
          genres: ['Sieci społecznościowe', 'Styl życia'],
        },
      }),
    ).toBe(true);
  });

  it('leaves the subtitle out when the stored default listing has none', () => {
    expect(
      servesLocalization(
        Store.APP_STORE,
        { ...english, subtitle: null },
        { ...english, subtitle: 'World Geography Trivia Game' },
      ),
    ).toBe(false);
  });

  it('compares the subtitle when the default listing was read without one', () => {
    expect(
      servesLocalization(
        Store.APP_STORE,
        { ...english, subtitle: null, subtitleUnavailable: false },
        { ...english, subtitle: 'Mapa Świata' },
      ),
    ).toBe(true);
  });

  it('does not serve a localization that only shows its category where the default has a subtitle', () => {
    const hindi = {
      title: 'Hindi Dictionary | हिंदी कोश',
      subtitle: 'Hindi-English, smart offline',
      subtitleUnavailable: false,
      description: 'Offline dictionary',
      raw: {
        screenshots: [shot(1), shot(2)],
        genres: ['Education', 'Reference'],
      },
    };

    expect(
      servesLocalization(Store.APP_STORE, hindi, {
        ...hindi,
        subtitle: 'শিক্ষা',
        raw: { ...hindi.raw, genres: ['শিক্ষা', 'রেফারেন্স'] },
      }),
    ).toBe(false);
  });

  it('does not serve a localization that has no subtitle where the default has one', () => {
    expect(
      servesLocalization(Store.APP_STORE, english, {
        ...english,
        subtitle: null,
      }),
    ).toBe(false);
  });

  it('serves a localization whose own subtitle differs while its text matches the default', () => {
    expect(
      servesLocalization(
        Store.APP_STORE,
        { ...english, subtitleUnavailable: false },
        { ...english, subtitle: 'ऑफ़लाइन शब्दकोश + क्विज़' },
      ),
    ).toBe(true);
  });

  it('serves a localization that drops its subtitle but translates the title', () => {
    expect(
      servesLocalization(Store.APP_STORE, english, {
        ...english,
        subtitle: null,
        title: 'Where Am I? Quiz Geograficzny',
      }),
    ).toBe(true);
  });

  it('ignores a change of rendition size of the same screenshots', () => {
    expect(
      servesLocalization(Store.APP_STORE, english, {
        ...english,
        raw: {
          ...english.raw,
          screenshots: [1, 2].map((n) =>
            shot(n).replace('392x696bb', '320x480bb'),
          ),
        },
      }),
    ).toBe(false);
  });
});
