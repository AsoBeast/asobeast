import {
  CAPTION_SIMILARITY,
  captionSimilarity,
  diffCaptions,
} from './caption-diff';

describe('captionSimilarity', () => {
  it('is 1 for the same text whatever its case or punctuation', () => {
    expect(captionSimilarity('Plan your week!', 'plan your WEEK')).toBe(1);
  });

  it('is 1 for two empty texts', () => {
    expect(captionSimilarity('', '')).toBe(1);
  });

  it('is high for one misread character and low for another sentence', () => {
    expect(
      captionSimilarity('Track every habit', 'Track every hablt'),
    ).toBeGreaterThan(CAPTION_SIMILARITY);
    expect(
      captionSimilarity('Track every habit', 'Sleep better tonight'),
    ).toBeLessThan(CAPTION_SIMILARITY);
  });
});

describe('diffCaptions', () => {
  it('finds nothing when the captions are the same', () => {
    expect(diffCaptions(['Plan your week'], ['Plan your week'])).toEqual({
      added: [],
      removed: [],
    });
  });

  it('ignores an ocr difference of a character or two', () => {
    expect(diffCaptions(['Track every habit'], ['Track every hablt'])).toEqual({
      added: [],
      removed: [],
    });
  });

  it('reports an edited caption as one removed and one added', () => {
    expect(diffCaptions(['Plan your week'], ['Plan your day'])).toEqual({
      added: ['Plan your day'],
      removed: ['Plan your week'],
    });
  });

  it('does not call a reorder a change', () => {
    expect(
      diffCaptions(
        ['First idea', 'Second idea'],
        ['Second idea', 'First idea'],
      ),
    ).toEqual({
      added: [],
      removed: [],
    });
  });

  it('reports a caption that appeared and one that disappeared', () => {
    expect(
      diffCaptions(
        ['Keep this', 'Drop this'],
        ['Keep this', 'Brand new words'],
      ),
    ).toEqual({
      added: ['Brand new words'],
      removed: ['Drop this'],
    });
  });

  it('compares japanese captions without spaces', () => {
    expect(
      diffCaptions(['毎日の習慣を記録しよう'], ['毎日の習慣を記録しよう']),
    ).toEqual({
      added: [],
      removed: [],
    });
  });
});
