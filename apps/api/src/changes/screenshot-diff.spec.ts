import { Store } from '@prisma/client';
import {
  describeImagesChange,
  diffScreenshotImages,
  KeyedScreenshot,
  screenshotImagesDetail,
  screenshotKeys,
} from './screenshot-diff';

const shots = (...keys: string[]): KeyedScreenshot[] =>
  keys.map((key) => ({ key, url: `${key}/392x696bb.jpg` }));

describe('diffScreenshotImages', () => {
  it('finds nothing when the list is identical', () => {
    expect(diffScreenshotImages(shots('a', 'b'), shots('a', 'b'))).toBeNull();
  });

  it('finds nothing when only the size of a rendition changed', () => {
    const before = [{ key: 'a', url: 'a/392x696bb.jpg' }];
    const after = [{ key: 'a', url: 'a/1080x0w.jpg' }];

    expect(diffScreenshotImages(before, after)).toBeNull();
  });

  it('reports a replaced screenshot by its position in both lists', () => {
    expect(
      diffScreenshotImages(shots('a', 'b', 'c'), shots('a', 'x', 'c')),
    ).toEqual({
      added: [2],
      removed: [2],
      reordered: false,
    });
  });

  it('reports an added screenshot', () => {
    expect(diffScreenshotImages(shots('a', 'b'), shots('a', 'b', 'c'))).toEqual(
      {
        added: [3],
        removed: [],
        reordered: false,
      },
    );
  });

  it('reports a removed screenshot', () => {
    expect(diffScreenshotImages(shots('a', 'b', 'c'), shots('a', 'c'))).toEqual(
      {
        added: [],
        removed: [2],
        reordered: false,
      },
    );
  });

  it('reports a pure reorder', () => {
    expect(
      diffScreenshotImages(shots('a', 'b', 'c'), shots('c', 'a', 'b')),
    ).toEqual({
      added: [],
      removed: [],
      reordered: true,
    });
  });

  it('does not call a removal a reorder', () => {
    expect(
      diffScreenshotImages(shots('a', 'b', 'c'), shots('a', 'c'))?.reordered,
    ).toBe(false);
  });

  it('reports a replacement and a reorder together', () => {
    expect(
      diffScreenshotImages(shots('a', 'b', 'c'), shots('c', 'x', 'a')),
    ).toEqual({
      added: [2],
      removed: [2],
      reordered: true,
    });
  });
});

describe('describeImagesChange', () => {
  it.each([
    [
      3,
      3,
      { added: [2], removed: [2], reordered: false },
      { before: '3 screenshots', after: '3 screenshots, 1 replaced' },
    ],
    [
      3,
      3,
      { added: [], removed: [], reordered: true },
      { before: '3 screenshots', after: '3 screenshots, reordered' },
    ],
    [
      3,
      3,
      { added: [1, 2], removed: [1, 2], reordered: true },
      {
        before: '3 screenshots',
        after: '3 screenshots, 2 replaced, reordered',
      },
    ],
    [
      2,
      3,
      { added: [3], removed: [], reordered: false },
      { before: '2 screenshots', after: '3 screenshots, 1 added' },
    ],
    [
      1,
      1,
      { added: [1], removed: [1], reordered: false },
      { before: '1 screenshot', after: '1 screenshot, 1 replaced' },
    ],
  ])(
    'describes %i to %i screenshots as %#',
    (beforeCount, afterCount, diff, expected) => {
      expect(describeImagesChange(beforeCount, afterCount, diff)).toEqual(
        expected,
      );
    },
  );
});

describe('screenshotKeys', () => {
  const apple = 'https://is1-ssl.mzstatic.com/image/thumb/p/v4/aa/1.jpg';

  it('keys every address of a snapshot payload by its asset', () => {
    expect(
      screenshotKeys(Store.APP_STORE, {
        screenshots: [`${apple}/392x696bb.jpg`],
      }),
    ).toEqual([
      {
        key: 'https://mzstatic.com/image/thumb/p/v4/aa/1.jpg',
        url: `${apple}/392x696bb.jpg`,
      },
    ]);
  });

  it('returns null for a payload that carries no screenshot list', () => {
    expect(screenshotKeys(Store.APP_STORE, { source: 'fixture' })).toBeNull();
    expect(screenshotKeys(Store.APP_STORE, null)).toBeNull();
  });
});

describe('screenshotImagesDetail', () => {
  it('numbers both lists from 1 and carries the diff', () => {
    const before = shots('a', 'b');
    const after = shots('a', 'x');
    const diff = { added: [2], removed: [2], reordered: false };

    expect(screenshotImagesDetail(before, after, diff)).toEqual({
      kind: 'images',
      before: [
        { position: 1, url: 'a/392x696bb.jpg' },
        { position: 2, url: 'b/392x696bb.jpg' },
      ],
      after: [
        { position: 1, url: 'a/392x696bb.jpg' },
        { position: 2, url: 'x/392x696bb.jpg' },
      ],
      added: [2],
      removed: [2],
      reordered: false,
    });
  });
});
