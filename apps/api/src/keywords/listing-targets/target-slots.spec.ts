import {
  normalizeTargetSlots,
  phrasesToTrack,
  targetPairs,
} from './target-slots';

describe('normalizeTargetSlots', () => {
  it('normalizes each phrase like a tracked keyword', () => {
    expect(normalizeTargetSlots(['  Habit  Tracker '])).toEqual({
      ok: true,
      slots: ['habit tracker'],
    });
  });

  it('trims empty slots at the end and keeps them in the middle', () => {
    expect(normalizeTargetSlots(['a', null, 'b', null])).toEqual({
      ok: true,
      slots: ['a', '', 'b'],
    });
  });

  it('reads a blank phrase as an empty slot', () => {
    expect(normalizeTargetSlots(['   ', 'b'])).toEqual({
      ok: true,
      slots: ['', 'b'],
    });
  });

  it('answers no slots for a list of empty slots', () => {
    expect(normalizeTargetSlots([null, null])).toEqual({ ok: true, slots: [] });
  });

  it('refuses a duplicate with its two positions', () => {
    expect(normalizeTargetSlots(['focus', null, 'Focus'])).toEqual({
      ok: false,
      message: 'Targets 1 and 3 are both "focus"',
    });
  });

  it('refuses an invalid phrase with its position', () => {
    expect(normalizeTargetSlots(['ok', 'x'.repeat(101)])).toEqual({
      ok: false,
      message: 'Target 2: Keyword exceeds 100 characters',
    });
  });

  it('refuses more than ten slots', () => {
    expect(
      normalizeTargetSlots(
        Array.from({ length: 11 }, (_, index) => `k${index}`),
      ),
    ).toEqual({
      ok: false,
      message:
        'A localization takes at most 10 target keywords, this list has 11',
    });
  });
});

describe('phrasesToTrack', () => {
  it('tracks only the phrases new to the stored list', () => {
    expect(phrasesToTrack(['b', '', 'a', 'c'], ['a', 'b'], false)).toEqual([
      'c',
    ]);
  });

  it('tracks every slot when asked to track the missing ones', () => {
    expect(phrasesToTrack(['b', '', 'a'], ['a', 'b'], true)).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('targetPairs', () => {
  it('pairs phrases with readers in slot order then reader order', () => {
    expect(targetPairs(['a', 'b'], ['gb', 'au'])).toEqual([
      { text: 'a', country: 'gb' },
      { text: 'a', country: 'au' },
      { text: 'b', country: 'gb' },
      { text: 'b', country: 'au' },
    ]);
  });
});
