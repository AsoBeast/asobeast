import {
  screenshotTextCoverage,
  screenshotTextState,
} from './screenshot-coverage';

const shot = (position: number, status: string, caption: string | null) => ({
  position,
  status,
  caption,
});

describe('screenshotTextCoverage', () => {
  const captions = [
    shot(1, 'read', 'Track every habit'),
    shot(2, 'blank', null),
    shot(3, 'read', 'Your habit tracker, simplified'),
  ];

  it('lists every screenshot whose caption contains the keyword as whole words', () => {
    expect(screenshotTextCoverage(captions, 'habit tracker')).toEqual({
      covered: true,
      positions: [3],
    });
    expect(screenshotTextCoverage(captions, 'habit')).toEqual({
      covered: true,
      positions: [1, 3],
    });
  });

  it('does not count part of a word', () => {
    expect(screenshotTextCoverage(captions, 'rack')).toEqual({
      covered: false,
      positions: [],
    });
  });

  it('ignores case and punctuation', () => {
    expect(screenshotTextCoverage(captions, 'HABIT TRACKER')).toEqual({
      covered: true,
      positions: [3],
    });
  });

  it('reads a japanese keyword inside a japanese caption', () => {
    expect(
      screenshotTextCoverage(
        [shot(1, 'read', '毎日の習慣を記録しよう')],
        '習慣',
      ),
    ).toEqual({ covered: true, positions: [1] });
  });

  it('ignores a screenshot that has no caption', () => {
    expect(screenshotTextCoverage([shot(1, 'blank', null)], 'habit')).toEqual({
      covered: false,
      positions: [],
    });
  });
});

describe('screenshotTextState', () => {
  it('is absent for a store that is not read', () => {
    expect(screenshotTextState([], 'unsupported')).toBeNull();
  });

  it('is off when reading is switched off', () => {
    expect(
      screenshotTextState(
        [shot(1, 'skipped', null), shot(2, 'skipped', null)],
        'off',
      ),
    ).toEqual({ status: 'off', read: 0, total: 2 });
  });

  it('is reading while any screenshot is pending', () => {
    expect(
      screenshotTextState(
        [shot(1, 'read', 'a'), shot(2, 'pending', null)],
        'on',
      ),
    ).toEqual({ status: 'reading', read: 1, total: 2 });
  });

  it('is empty when nothing carried a caption', () => {
    expect(
      screenshotTextState(
        [shot(1, 'blank', null), shot(2, 'failed', null)],
        'on',
      ),
    ).toEqual({ status: 'empty', read: 0, total: 2 });
    expect(screenshotTextState([], 'on')).toEqual({
      status: 'empty',
      read: 0,
      total: 0,
    });
  });

  it('is ready once at least one caption was read and nothing is pending', () => {
    expect(
      screenshotTextState([shot(1, 'read', 'a'), shot(2, 'blank', null)], 'on'),
    ).toEqual({ status: 'ready', read: 1, total: 2 });
  });
});
