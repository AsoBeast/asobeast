import { Store } from '@prisma/client';
import { MAX_RECORDED_SCREENSHOTS, screenshotRows } from './screenshot-rows';

const apple = (n: number) =>
  `https://is1-ssl.mzstatic.com/image/thumb/PurpleSource/v4/aa/bb/${n}/shot.jpg`;
const appleKey = (n: number) =>
  `https://mzstatic.com/image/thumb/PurpleSource/v4/aa/bb/${n}/shot.jpg`;

describe('screenshotRows', () => {
  it('numbers the screenshots from 1 in store order and keys each by its asset', () => {
    const raw = { screenshots: [1, 2].map((n) => `${apple(n)}/392x696bb.jpg`) };

    expect(screenshotRows(Store.APP_STORE, raw, 'pending')).toEqual([
      {
        position: 1,
        url: `${apple(1)}/392x696bb.jpg`,
        assetKey: appleKey(1),
        status: 'pending',
      },
      {
        position: 2,
        url: `${apple(2)}/392x696bb.jpg`,
        assetKey: appleKey(2),
        status: 'pending',
      },
    ]);
  });

  it('keys a google play image without its size suffix', () => {
    const raw = {
      screenshots: ['https://play-lh.googleusercontent.com/AbC=w526-h296-rw'],
    };

    expect(screenshotRows(Store.GOOGLE_PLAY, raw, 'skipped')).toEqual([
      {
        position: 1,
        url: 'https://play-lh.googleusercontent.com/AbC=w526-h296-rw',
        assetKey: 'https://play-lh.googleusercontent.com/AbC',
        status: 'skipped',
      },
    ]);
  });

  it('keeps at most the first ten', () => {
    const raw = {
      screenshots: Array.from(
        { length: 14 },
        (_, n) => `${apple(n)}/392x696bb.jpg`,
      ),
    };

    const rows = screenshotRows(Store.APP_STORE, raw, 'pending');

    expect(rows).toHaveLength(MAX_RECORDED_SCREENSHOTS);
    expect(rows.at(-1)?.position).toBe(MAX_RECORDED_SCREENSHOTS);
  });

  it.each([null, undefined, {}, { screenshots: 'nope' }, { screenshots: [] }])(
    'returns nothing for the payload %j',
    (raw) => {
      expect(screenshotRows(Store.APP_STORE, raw, 'pending')).toEqual([]);
    },
  );

  it('ignores entries that are not addresses', () => {
    const raw = { screenshots: [42, null, `${apple(1)}/392x696bb.jpg`] };

    expect(screenshotRows(Store.APP_STORE, raw, 'pending')).toHaveLength(1);
  });
});
