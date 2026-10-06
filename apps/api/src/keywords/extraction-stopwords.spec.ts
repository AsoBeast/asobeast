import { isExtractionStopword, isStoreNoise } from './extraction-stopwords';

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

  it('flags arabic function words and store noise', () => {
    expect(isExtractionStopword('في')).toBe(true);
    expect(isExtractionStopword('أكثر')).toBe(true);
    expect(isExtractionStopword('تطبيق')).toBe(true);
    expect(isExtractionStopword('طعام')).toBe(false);
    expect(isExtractionStopword('كريم')).toBe(false);
  });

  it('flags an arabic stopword after the conjunction', () => {
    expect(isExtractionStopword('وأكثر')).toBe(true);
    expect(isExtractionStopword('وفي')).toBe(true);
    expect(isExtractionStopword('ومن')).toBe(true);
  });

  it('keeps an arabic word that only begins with the conjunction letter', () => {
    expect(isExtractionStopword('وقت')).toBe(false);
    expect(isExtractionStopword('واتساب')).toBe(false);
    expect(isExtractionStopword('وصفة')).toBe(false);
    expect(isExtractionStopword('وطعام')).toBe(false);
    expect(isExtractionStopword('و')).toBe(false);
  });

  it('matches arabic stopwords written with tatweel or harakat', () => {
    expect(isExtractionStopword('وأكـثر')).toBe(true);
    expect(isExtractionStopword('أَكْثَر')).toBe(true);
    expect(isExtractionStopword('تـطـبـيـق')).toBe(true);
    expect(isExtractionStopword('وَقْت')).toBe(false);
  });

  it('flags the common arabic store forms', () => {
    for (const word of ['او', 'ان', 'تطبيقات', 'التطبيق', 'الأفضل', 'مجانية']) {
      expect(isExtractionStopword(word)).toBe(true);
    }
  });
});

describe('isStoreNoise', () => {
  it('flags store noise but not pronouns or particles', () => {
    expect(isStoreNoise('アプリ')).toBe(true);
    expect(isStoreNoise('免费')).toBe(true);
    expect(isStoreNoise('แอป')).toBe(true);
    expect(isStoreNoise('我的')).toBe(false);
    expect(isStoreNoise('และ')).toBe(false);
  });
});
