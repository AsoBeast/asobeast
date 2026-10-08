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
