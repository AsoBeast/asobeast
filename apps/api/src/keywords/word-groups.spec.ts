import { wordGroups } from './word-groups';

describe('wordGroups', () => {
  it('returns no group for empty text or punctuation only', () => {
    expect(wordGroups('')).toEqual([]);
    expect(wordGroups('   ')).toEqual([]);
    expect(wordGroups('!!!')).toEqual([]);
  });

  it('keeps space separated words in one group joined by a space', () => {
    expect(wordGroups('Zombie Castle Defense')).toEqual([
      {
        tokens: ['zombie', 'castle', 'defense'],
        joiner: ' ',
        startsChunk: false,
      },
    ]);
    expect(wordGroups('카카오톡은 무료')).toEqual([
      { tokens: ['카카오톡은', '무료'], joiner: ' ', startsChunk: false },
    ]);
    expect(wordGroups('وأكثر')).toEqual([
      { tokens: ['وأكثر'], joiner: ' ', startsChunk: false },
    ]);
  });

  it('keeps a brand and a short hiragana chunk as one token', () => {
    expect(wordGroups('微信')).toEqual([
      { tokens: ['微信'], joiner: '', startsChunk: true },
    ]);
    expect(wordGroups('ふりま あぷり')).toEqual([
      { tokens: ['ふりま'], joiner: '', startsChunk: true },
      { tokens: ['あぷり'], joiner: '', startsChunk: true },
    ]);
  });

  it('trims store noise words from the edges of a run', () => {
    expect(wordGroups('無料アプリ')).toEqual([]);
    expect(wordGroups('無料ゲーム')).toEqual([
      { tokens: ['ゲーム'], joiner: '', startsChunk: false },
    ]);
    expect(wordGroups('しまむら公式アプリ')).toEqual([
      { tokens: ['しまむら'], joiner: '', startsChunk: true },
    ]);
  });

  it('splits a longer chunk at the words of the segmenter', () => {
    expect(wordGroups('フリマアプリで簡単ショッピング')).toEqual([
      { tokens: ['フリマアプリ'], joiner: '', startsChunk: true },
      { tokens: ['簡単', 'ショッピング'], joiner: '', startsChunk: false },
    ]);
    expect(wordGroups('สั่งอาหารออนไลน์')).toEqual([
      { tokens: ['สั่งอาหาร', 'ออนไลน์'], joiner: '', startsChunk: true },
    ]);
  });

  it('splits lao, khmer and burmese the same way', () => {
    expect(wordGroups('ສະບາຍດີທຸກຄົນ')).toEqual([
      { tokens: ['ສະບາຍດີ', 'ທຸກຄົນ'], joiner: '', startsChunk: true },
    ]);
    expect(wordGroups('សួស្តីពិភពលោក')).toEqual([
      { tokens: ['សួស្តី', 'ពិភពលោក'], joiner: '', startsChunk: true },
    ]);
  });

  it('ends a group at a hiragana word and drops the hiragana', () => {
    expect(wordGroups('かんたんスマホ決済のメルペイでお得に')).toEqual([
      { tokens: ['スマホ', '決済'], joiner: '', startsChunk: false },
      { tokens: ['メルペイ'], joiner: '', startsChunk: false },
      { tokens: ['得'], joiner: '', startsChunk: false },
    ]);
    expect(wordGroups('ひまつぶしゲーム')).toEqual([
      { tokens: ['ゲーム'], joiner: '', startsChunk: false },
    ]);
  });

  it('merges single han characters and splits at chinese particles', () => {
    expect(wordGroups('与朋友畅聊的免费')).toEqual([
      { tokens: ['朋友', '畅聊'], joiner: '', startsChunk: false },
    ]);
    expect(wordGroups('家計簿アプリで簡単管理')).toEqual([
      { tokens: ['家計', '簿', 'アプリ'], joiner: '', startsChunk: true },
      { tokens: ['簡単', '管理'], joiner: '', startsChunk: false },
    ]);
  });

  it('joins a katakana word the segmenter split into pieces', () => {
    expect(wordGroups('ネットフリックスで映画')).toEqual([
      { tokens: ['ネットフリックス'], joiner: '', startsChunk: true },
      { tokens: ['映画'], joiner: '', startsChunk: false },
    ]);
    expect(wordGroups('ニンテンドースイッチ')).toEqual([
      { tokens: ['ニンテンドー', 'スイッチ'], joiner: '', startsChunk: true },
    ]);
    expect(wordGroups('ラクマで売る')).toEqual([
      { tokens: ['ラクマ'], joiner: '', startsChunk: true },
      { tokens: ['売る'], joiner: '', startsChunk: false },
    ]);
  });

  it('joins a piece of two characters or fewer to the katakana after it', () => {
    expect(wordGroups('プリティーダービー')).toEqual([
      { tokens: ['プリティー', 'ダービー'], joiner: '', startsChunk: true },
    ]);
    expect(wordGroups('ワルキューレ')).toEqual([
      { tokens: ['ワルキューレ'], joiner: '', startsChunk: true },
    ]);
    expect(wordGroups('ダンジョン')).toEqual([
      { tokens: ['ダンジョン'], joiner: '', startsChunk: true },
    ]);
    expect(wordGroups('ノノグラムロジックパズル')).toEqual([
      {
        tokens: ['ノノグラム', 'ロジック', 'パズル'],
        joiner: '',
        startsChunk: true,
      },
    ]);
  });

  it('puts latin and spaceless words in separate groups', () => {
    expect(wordGroups('Photo Editor 写真加工')).toEqual([
      { tokens: ['photo', 'editor'], joiner: ' ', startsChunk: false },
      { tokens: ['写真', '加工'], joiner: '', startsChunk: true },
    ]);
    expect(wordGroups('Spotifyで音楽を聴こう')).toEqual([
      { tokens: ['spotify'], joiner: ' ', startsChunk: false },
      { tokens: ['音楽'], joiner: '', startsChunk: false },
      { tokens: ['聴'], joiner: '', startsChunk: false },
    ]);
    expect(wordGroups('3Dゲーム')).toEqual([
      { tokens: ['3d'], joiner: ' ', startsChunk: false },
      { tokens: ['ゲーム'], joiner: '', startsChunk: false },
    ]);
  });

  it('starts a new group at a dash, a space or punctuation', () => {
    expect(wordGroups('メルカリ - フリマアプリ')).toEqual([
      { tokens: ['メルカリ'], joiner: '', startsChunk: true },
      { tokens: ['フリマアプリ'], joiner: '', startsChunk: true },
    ]);
    expect(wordGroups('Yahoo!乗換案内')).toEqual([
      { tokens: ['yahoo'], joiner: ' ', startsChunk: false },
      { tokens: ['乗換', '案内'], joiner: '', startsChunk: true },
    ]);
  });

  it('splits at chinese particles only in text without kana', () => {
    expect(wordGroups('東京都防災アプリ')).toEqual([
      { tokens: ['東京', '都', '防災'], joiner: '', startsChunk: true },
    ]);
    expect(wordGroups('和风天气 在线教育')).toEqual([
      { tokens: ['和风', '天气'], joiner: '', startsChunk: true },
      { tokens: ['在线', '教育'], joiner: '', startsChunk: true },
    ]);
  });

  it('adds a short title with a pronoun as a whole', () => {
    expect(wordGroups('我的世界')).toEqual([
      { tokens: ['我的', '世界'], joiner: '', startsChunk: true },
      { tokens: ['我的世界'], joiner: '', startsChunk: false },
    ]);
  });
});
