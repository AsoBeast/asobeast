import { resolvedArtworkUrl } from './app-store-artwork';

describe('resolvedArtworkUrl', () => {
  it('resolves an icon template to the square jpeg the store serves', () => {
    expect(
      resolvedArtworkUrl(
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/45/8f/b0/458fb0c1-ee2e-4a36-1cc2-f6fe8b86735b/Placeholder.mill/{w}x{h}{c}.{f}',
      ),
    ).toBe(
      'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/45/8f/b0/458fb0c1-ee2e-4a36-1cc2-f6fe8b86735b/Placeholder.mill/300x300bb.jpg',
    );
  });

  it('resolves the tokens a template carries and leaves the rest alone', () => {
    expect(resolvedArtworkUrl('https://shot/{w}x{h}')).toBe(
      'https://shot/300x300',
    );
  });

  it('keeps a url without template tokens as it came', () => {
    expect(
      resolvedArtworkUrl('https://is1-ssl.mzstatic.com/icon/512x512bb.jpg'),
    ).toBe('https://is1-ssl.mzstatic.com/icon/512x512bb.jpg');
  });
});
