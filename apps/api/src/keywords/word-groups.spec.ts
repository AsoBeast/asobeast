import { wordGroups } from './word-groups';

describe('wordGroups', () => {
  it('returns no group for empty text or punctuation only', () => {
    expect(wordGroups('')).toEqual([]);
    expect(wordGroups('   ')).toEqual([]);
    expect(wordGroups('!!!')).toEqual([]);
  });

  it('keeps space separated words in one group joined by a space', () => {
    expect(wordGroups('Zombie Castle Defense')).toEqual([
      { tokens: ['zombie', 'castle', 'defense'], joiner: ' ' },
    ]);
    expect(wordGroups('카카오톡은 무료')).toEqual([
      { tokens: ['카카오톡은', '무료'], joiner: ' ' },
    ]);
    expect(wordGroups('وأكثر')).toEqual([{ tokens: ['وأكثر'], joiner: ' ' }]);
  });

  it('keeps a short spaceless chunk as one token', () => {
    expect(wordGroups('微信')).toEqual([{ tokens: ['微信'], joiner: '' }]);
    expect(wordGroups('ふりま あぷり')).toEqual([
      { tokens: ['ふりま'], joiner: '' },
      { tokens: ['あぷり'], joiner: '' },
    ]);
  });

  it('trims store noise words from the edges of a run', () => {
    expect(wordGroups('無料アプリ')).toEqual([]);
    expect(wordGroups('無料ゲーム')).toEqual([
      { tokens: ['ゲーム'], joiner: '' },
    ]);
    expect(wordGroups('しまむら公式アプリ')).toEqual([
      { tokens: ['しまむら'], joiner: '' },
    ]);
  });

  it('splits a longer chunk at the words of the segmenter', () => {
    expect(wordGroups('フリマアプリで簡単ショッピング')).toEqual([
      { tokens: ['フリマアプリ'], joiner: '' },
      { tokens: ['簡単', 'ショッピング'], joiner: '' },
    ]);
    expect(wordGroups('สั่งอาหารออนไลน์')).toEqual([
      { tokens: ['สั่ง', 'อาหาร', 'ออนไลน์'], joiner: '' },
    ]);
  });

  it('splits lao, khmer and burmese the same way', () => {
    expect(wordGroups('ສະບາຍດີທຸກຄົນ')).toEqual([
      { tokens: ['ສະບາຍດີ', 'ທຸກຄົນ'], joiner: '' },
    ]);
    expect(wordGroups('សួស្តីពិភពលោក')).toEqual([
      { tokens: ['សួស្តី', 'ពិភពលោក'], joiner: '' },
    ]);
  });

  it('ends a group at a hiragana word and drops the hiragana', () => {
    expect(wordGroups('かんたんスマホ決済のメルペイでお得に')).toEqual([
      { tokens: ['スマホ', '決済'], joiner: '' },
      { tokens: ['メルペイ'], joiner: '' },
      { tokens: ['得'], joiner: '' },
    ]);
    expect(wordGroups('ひまつぶしゲーム')).toEqual([
      { tokens: ['ゲーム'], joiner: '' },
    ]);
  });

  it('joins a katakana word the segmenter split into pieces', () => {
    expect(wordGroups('ネットフリックスで映画')).toEqual([
      { tokens: ['ネットフリックス'], joiner: '' },
      { tokens: ['映画'], joiner: '' },
    ]);
    expect(wordGroups('ニンテンドースイッチ')).toEqual([
      { tokens: ['ニンテンドー', 'スイッチ'], joiner: '' },
    ]);
    expect(wordGroups('ラクマで売る')).toEqual([
      { tokens: ['ラクマ'], joiner: '' },
      { tokens: ['売る'], joiner: '' },
    ]);
  });

  it('puts latin and spaceless words in separate groups', () => {
    expect(wordGroups('Photo Editor 写真加工')).toEqual([
      { tokens: ['photo', 'editor'], joiner: ' ' },
      { tokens: ['写真加工'], joiner: '' },
    ]);
    expect(wordGroups('Spotifyで音楽を聴こう')).toEqual([
      { tokens: ['spotify'], joiner: ' ' },
      { tokens: ['音楽'], joiner: '' },
      { tokens: ['聴'], joiner: '' },
    ]);
    expect(wordGroups('3Dゲーム')).toEqual([
      { tokens: ['3d'], joiner: ' ' },
      { tokens: ['ゲーム'], joiner: '' },
    ]);
  });

  it('starts a new group at a dash, a space or punctuation', () => {
    expect(wordGroups('メルカリ - フリマアプリ')).toEqual([
      { tokens: ['メルカリ'], joiner: '' },
      { tokens: ['フリマアプリ'], joiner: '' },
    ]);
    expect(wordGroups('Yahoo!乗換案内')).toEqual([
      { tokens: ['yahoo'], joiner: ' ' },
      { tokens: ['乗換案内'], joiner: '' },
    ]);
  });
});
