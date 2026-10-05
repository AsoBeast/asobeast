import { isExtractionStopword } from './extraction-stopwords';

describe('isExtractionStopword', () => {
  it('keeps every english stopword', () => {
    expect(isExtractionStopword('the')).toBe(true);
    expect(isExtractionStopword('free')).toBe(true);
    expect(isExtractionStopword('tracker')).toBe(false);
  });

  it('flags japanese, chinese and thai store noise', () => {
    expect(isExtractionStopword('アプリ')).toBe(true);
    expect(isExtractionStopword('無料')).toBe(true);
    expect(isExtractionStopword('免费')).toBe(true);
    expect(isExtractionStopword('应用')).toBe(true);
    expect(isExtractionStopword('แอป')).toBe(true);
    expect(isExtractionStopword('และ')).toBe(true);
    expect(isExtractionStopword('メルカリ')).toBe(false);
    expect(isExtractionStopword('微信')).toBe(false);
    expect(isExtractionStopword('อาหาร')).toBe(false);
  });
});
