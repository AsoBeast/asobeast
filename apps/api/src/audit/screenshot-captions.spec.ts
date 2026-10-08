import { readCaptionTexts } from './screenshot-captions';

const shot = (status: string, caption: string | null) => ({ status, caption });

describe('readCaptionTexts', () => {
  it('returns the captions of the screenshots that were read, in order', () => {
    expect(
      readCaptionTexts([
        shot('read', 'one'),
        shot('blank', null),
        shot('read', 'two'),
      ]),
    ).toEqual(['one', 'two']);
  });

  it('returns an empty list when every settled screenshot is blank', () => {
    expect(readCaptionTexts([shot('blank', null)])).toEqual([]);
  });

  it('returns null while nothing has settled', () => {
    expect(
      readCaptionTexts([shot('pending', null), shot('failed', null)]),
    ).toBeNull();
    expect(readCaptionTexts([shot('skipped', null)])).toBeNull();
  });

  it('returns null while any screenshot is still being read', () => {
    expect(
      readCaptionTexts([shot('read', 'one'), shot('pending', null)]),
    ).toBeNull();
  });

  it('returns null for no screenshots', () => {
    expect(readCaptionTexts([])).toBeNull();
  });
});
