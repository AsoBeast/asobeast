import { Store } from '@prisma/client';
import {
  appleRenditionUrl,
  OCR_RENDITION_WIDTH,
  screenshotAssetKey,
} from './screenshot-urls';

const ASSET =
  'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/50/e2/8b/50e28b44/1_iOS_5.5.jpg';

describe('screenshotAssetKey', () => {
  it('strips the size segment of an app store thumbnail', () => {
    expect(screenshotAssetKey(Store.APP_STORE, `${ASSET}/392x696bb.jpg`)).toBe(
      ASSET,
    );
  });

  it.each(['392x696bb.jpg', '1080x0w.jpg', '1080x0w.webp', '1242x2688bb.png'])(
    'gives the same key for the %s rendition',
    (rendition) => {
      expect(screenshotAssetKey(Store.APP_STORE, `${ASSET}/${rendition}`)).toBe(
        ASSET,
      );
    },
  );

  it('strips the size suffix of a google play image', () => {
    expect(
      screenshotAssetKey(
        Store.GOOGLE_PLAY,
        'https://play-lh.googleusercontent.com/AbC123xyz=w526-h296-rw',
      ),
    ).toBe('https://play-lh.googleusercontent.com/AbC123xyz');
  });

  it('returns an address that carries no size unchanged', () => {
    expect(screenshotAssetKey(Store.APP_STORE, ASSET)).toBe(ASSET);
  });
});

describe('appleRenditionUrl', () => {
  it('asks the cdn for the ocr width as a jpeg', () => {
    expect(appleRenditionUrl(`${ASSET}/392x696bb.jpg`)).toBe(
      `${ASSET}/${OCR_RENDITION_WIDTH}x0w.jpg`,
    );
  });

  it('honours another width', () => {
    expect(appleRenditionUrl(`${ASSET}/392x696bb.jpg`, 540)).toBe(
      `${ASSET}/540x0w.jpg`,
    );
  });

  it('accepts every numbered image host', () => {
    const url = ASSET.replace('is1-ssl', 'is5-ssl');
    expect(appleRenditionUrl(`${url}/392x696bb.jpg`)).toBe(
      `${url}/${OCR_RENDITION_WIDTH}x0w.jpg`,
    );
  });

  it.each([
    ['plain http', ASSET.replace('https', 'http')],
    ['another host', 'https://images.example.com/a.jpg/392x696bb.jpg'],
    [
      'a look alike host',
      'https://mzstatic.com.evil.example/a.jpg/392x696bb.jpg',
    ],
    [
      'a host that only ends the same',
      'https://notmzstatic.com/a.jpg/392x696bb.jpg',
    ],
    ['text that is not an address', 'not a url'],
  ])('refuses %s', (_label, url) => {
    expect(appleRenditionUrl(url)).toBeNull();
  });
});
