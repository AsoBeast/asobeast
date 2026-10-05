import { extractCandidates } from './extraction';

describe('extractCandidates', () => {
  it('extracts weighted ngrams from a game title with subtitle', () => {
    expect(
      extractCandidates({
        title: 'Zombie Castle Defense',
        subtitle: 'Tower strategy game',
      }),
    ).toEqual([
      { text: 'zombie castle defense', source: 'TITLE', weight: 3 },
      { text: 'zombie castle', source: 'TITLE', weight: 3 },
      { text: 'castle defense', source: 'TITLE', weight: 3 },
      { text: 'zombie', source: 'TITLE', weight: 3 },
      { text: 'castle', source: 'TITLE', weight: 3 },
      { text: 'defense', source: 'TITLE', weight: 3 },
      { text: 'tower strategy game', source: 'SUBTITLE', weight: 2 },
      { text: 'tower strategy', source: 'SUBTITLE', weight: 2 },
      { text: 'strategy game', source: 'SUBTITLE', weight: 2 },
      { text: 'tower', source: 'SUBTITLE', weight: 2 },
      { text: 'strategy', source: 'SUBTITLE', weight: 2 },
      { text: 'game', source: 'SUBTITLE', weight: 2 },
    ]);
  });

  it('does not build ngrams across separators for a utility app', () => {
    expect(
      extractCandidates({ title: 'PDF Scanner & Document Reader' }),
    ).toEqual([
      { text: 'pdf scanner', source: 'TITLE', weight: 3 },
      { text: 'document reader', source: 'TITLE', weight: 3 },
      { text: 'pdf', source: 'TITLE', weight: 3 },
      { text: 'scanner', source: 'TITLE', weight: 3 },
      { text: 'document', source: 'TITLE', weight: 3 },
      { text: 'reader', source: 'TITLE', weight: 3 },
    ]);
  });

  it('handles a one word brand title', () => {
    expect(extractCandidates({ title: 'Spotify' })).toEqual([
      { text: 'spotify', source: 'TITLE', weight: 3 },
    ]);
  });

  it('keeps the highest weight source when a term repeats', () => {
    expect(
      extractCandidates({ title: 'Streak', subtitle: 'streak counter' }),
    ).toEqual([
      { text: 'streak', source: 'TITLE', weight: 3 },
      { text: 'streak counter', source: 'SUBTITLE', weight: 2 },
      { text: 'counter', source: 'SUBTITLE', weight: 2 },
    ]);
  });

  it('maps summary candidates to the DESCRIPTION source', () => {
    expect(
      extractCandidates({ title: 'Notes', summary: 'markdown editor' }),
    ).toEqual([
      { text: 'notes', source: 'TITLE', weight: 3 },
      { text: 'markdown editor', source: 'DESCRIPTION', weight: 1 },
      { text: 'markdown', source: 'DESCRIPTION', weight: 1 },
      { text: 'editor', source: 'DESCRIPTION', weight: 1 },
    ]);
  });

  describe('listings written without spaces', () => {
    const texts = (input: Parameters<typeof extractCandidates>[0]): string[] =>
      extractCandidates(input).map((candidate) => candidate.text);

    const MERCARI_SUMMARY =
      'かんたんスマホ決済のメルペイでお得にショッピングも ふりま あぷり';

    it('tracks the words of a japanese google play listing, not its sentence', () => {
      expect(
        extractCandidates({
          title: 'メルカリ - フリマアプリ',
          summary: MERCARI_SUMMARY,
        }),
      ).toEqual([
        { text: 'メルカリ', source: 'TITLE', weight: 3 },
        { text: 'フリマアプリ', source: 'TITLE', weight: 3 },
        { text: 'スマホ決済', source: 'DESCRIPTION', weight: 1 },
        { text: 'スマホ', source: 'DESCRIPTION', weight: 1 },
        { text: '決済', source: 'DESCRIPTION', weight: 1 },
        { text: 'メルペイ', source: 'DESCRIPTION', weight: 1 },
        { text: 'ショッピング', source: 'DESCRIPTION', weight: 1 },
        { text: 'ふりま', source: 'DESCRIPTION', weight: 1 },
        { text: 'あぷり', source: 'DESCRIPTION', weight: 1 },
      ]);
    });

    it('never offers a sentence from a japanese listing', () => {
      const found = texts({
        title: 'メルカリ - フリマアプリ',
        subtitle: 'フリマアプリで簡単ショッピング 日本最大のフリマを楽しもう',
        summary: MERCARI_SUMMARY,
      });

      expect(found.length).toBeGreaterThan(5);
      expect(found.filter((text) => text.length > 10)).toEqual([]);
      expect(found).toEqual(
        expect.arrayContaining(['メルカリ', 'フリマアプリ', 'フリマ']),
      );
    });

    it('splits a japanese subtitle at its words', () => {
      expect(
        extractCandidates({
          title: 'メルカリ',
          subtitle: 'フリマアプリで簡単ショッピング 日本最大のフリマを楽しもう',
        }),
      ).toEqual([
        { text: 'メルカリ', source: 'TITLE', weight: 3 },
        { text: '簡単ショッピング', source: 'SUBTITLE', weight: 2 },
        { text: '日本最大', source: 'SUBTITLE', weight: 2 },
        { text: 'フリマアプリ', source: 'SUBTITLE', weight: 2 },
        { text: '簡単', source: 'SUBTITLE', weight: 2 },
        { text: 'ショッピング', source: 'SUBTITLE', weight: 2 },
        { text: '日本', source: 'SUBTITLE', weight: 2 },
        { text: '最大', source: 'SUBTITLE', weight: 2 },
        { text: 'フリマ', source: 'SUBTITLE', weight: 2 },
      ]);
    });

    it('joins the katakana pieces the dictionary splits inside a sentence', () => {
      expect(texts({ title: 'かんたんスマホ決済のメルペイでお得に' })).toEqual([
        'スマホ決済',
        'スマホ',
        '決済',
        'メルペイ',
      ]);
    });

    it('joins the pieces of a katakana loanword the dictionary does not know', () => {
      expect(texts({ title: 'ネットフリックス' })).toEqual([
        'ネットフリックス',
      ]);
      expect(texts({ title: 'ユーチューブ' })).toEqual(['ユーチューブ']);
      expect(texts({ title: 'ニンテンドースイッチオンライン' })).toEqual([
        'ニンテンドースイッチ',
        'スイッチオンライン',
        'ニンテンドー',
        'スイッチ',
        'オンライン',
      ]);
      expect(texts({ title: 'メモアプリ スマホゲーム' })).toEqual([
        'スマホゲーム',
        'メモ',
        'スマホ',
        'ゲーム',
      ]);
    });

    it('keeps a short chunk whole so a brand is not split into characters', () => {
      expect(texts({ title: '微信' })).toEqual(['微信']);
      expect(texts({ title: '淘宝 - 小红书' })).toEqual(['淘宝', '小红书']);
    });

    it('drops grammar and store noise words of a chinese listing', () => {
      expect(
        extractCandidates({
          title: '微信',
          subtitle: '一个让你随时随地与朋友畅聊的免费应用',
        }),
      ).toEqual([
        { text: '微信', source: 'TITLE', weight: 3 },
        { text: '随时随地', source: 'SUBTITLE', weight: 2 },
        { text: '随时', source: 'SUBTITLE', weight: 2 },
        { text: '随地', source: 'SUBTITLE', weight: 2 },
        { text: '朋友', source: 'SUBTITLE', weight: 2 },
      ]);
    });

    it('splits a thai listing into words and drops thai noise words', () => {
      expect(
        extractCandidates({
          title: 'Grab - แอปสั่งอาหาร',
          subtitle: 'สั่งอาหารและร้านอาหารที่ใหญ่ที่สุด',
        }),
      ).toEqual([
        { text: 'สั่งอาหาร', source: 'TITLE', weight: 3 },
        { text: 'grab', source: 'TITLE', weight: 3 },
        { text: 'สั่ง', source: 'TITLE', weight: 3 },
        { text: 'อาหาร', source: 'TITLE', weight: 3 },
        { text: 'ร้านอาหาร', source: 'SUBTITLE', weight: 2 },
        { text: 'ร้าน', source: 'SUBTITLE', weight: 2 },
        { text: 'ใหญ่', source: 'SUBTITLE', weight: 2 },
      ]);
    });

    it('builds latin phrases and spaceless words side by side', () => {
      expect(
        extractCandidates({
          title: 'Photo Editor 写真加工',
          subtitle: 'iPhone用カメラアプリ',
        }),
      ).toEqual([
        { text: 'photo editor', source: 'TITLE', weight: 3 },
        { text: 'photo', source: 'TITLE', weight: 3 },
        { text: 'editor', source: 'TITLE', weight: 3 },
        { text: '写真加工', source: 'TITLE', weight: 3 },
        { text: 'iphone', source: 'SUBTITLE', weight: 2 },
        { text: 'カメラ', source: 'SUBTITLE', weight: 2 },
      ]);
    });

    it('does not join words across a space, a dash or punctuation', () => {
      expect(texts({ title: 'メルカリ フリマアプリ' })).toEqual([
        'メルカリ',
        'フリマアプリ',
      ]);
      expect(texts({ title: 'Yahoo!乗換案内' })).toEqual(['yahoo', '乗換案内']);
    });

    it('breaks a phrase at a grammar word rather than joining across it', () => {
      expect(texts({ title: 'メルペイでお得にショッピング' })).toEqual([
        'メルペイ',
        'ショッピング',
      ]);
    });

    it('keeps a single long word whole and caps joined phrases', () => {
      expect(
        texts({ title: 'ミュージックプレイヤー ドラゴンクエストウォーク' }),
      ).toEqual([
        'ドラゴンクエスト',
        'クエストウォーク',
        'ミュージック',
        'プレイヤー',
        'ドラゴン',
        'クエスト',
        'ウォーク',
      ]);
    });

    it('drops store noise words at the edges of a short run', () => {
      expect(texts({ title: '無料アプリ' })).toEqual([]);
      expect(texts({ title: '公式アプリ' })).toEqual([]);
      expect(texts({ title: '無料ゲーム' })).toEqual(['ゲーム']);
    });

    it('keeps a hiragana name next to store noise words whole', () => {
      expect(texts({ title: 'しまむら公式アプリ' })).toEqual(['しまむら']);
      expect(texts({ title: 'ぬりえアプリ' })).toEqual(['ぬりえ']);
      expect(texts({ title: 'メルカリ公式アプリ' })).toEqual(['メルカリ']);
    });

    it('returns nothing for text made only of particles and punctuation', () => {
      expect(texts({ title: 'の、に。を！' })).toEqual([]);
    });

    it('ranks japanese phrases by field weight like any other', () => {
      const found = extractCandidates({
        title: '日本語学習',
        subtitle: '日本語学習 クイズ',
      });

      expect(found[0]).toEqual({
        text: '日本語学習',
        source: 'TITLE',
        weight: 3,
      });
      expect(found).toContainEqual({
        text: 'クイズ',
        source: 'SUBTITLE',
        weight: 2,
      });
    });
  });

  describe('arabic listings', () => {
    const texts = (input: Parameters<typeof extractCandidates>[0]): string[] =>
      extractCandidates(input).map((candidate) => candidate.text);

    it('drops an arabic noise word and the same word after the conjunction', () => {
      expect(texts({ title: 'كريم - توصيل طعام وأكثر' })).toEqual([
        'كريم توصيل طعام',
        'كريم توصيل',
        'توصيل طعام',
        'كريم',
        'توصيل',
        'طعام',
      ]);
    });

    it('drops arabic function words and a function word after the conjunction', () => {
      expect(texts({ title: 'الطعام في المطار ومن البيت' })).toEqual([
        'الطعام المطار البيت',
        'الطعام المطار',
        'المطار البيت',
        'الطعام',
        'المطار',
        'البيت',
      ]);
    });

    it('leaves a word that begins with the conjunction letter alone', () => {
      expect(texts({ title: 'وقت الصلاة' })).toEqual([
        'وقت الصلاة',
        'وقت',
        'الصلاة',
      ]);
      expect(texts({ title: 'واتساب وصفة وظيفة' })).toEqual([
        'واتساب وصفة وظيفة',
        'واتساب وصفة',
        'وصفة وظيفة',
        'واتساب',
        'وصفة',
        'وظيفة',
      ]);
    });
  });

  describe('scripts that keep spaces between words', () => {
    it('extracts korean, cyrillic, polish and devanagari as before', () => {
      expect(
        extractCandidates({ title: '카카오톡', subtitle: '무료 메신저' }).map(
          (candidate) => candidate.text,
        ),
      ).toEqual(['카카오톡', '무료 메신저', '무료', '메신저']);
      expect(
        extractCandidates({ title: 'Яндекс Карты' }).map(
          (candidate) => candidate.text,
        ),
      ).toEqual(['яндекс карты', 'яндекс', 'карты']);
      expect(
        extractCandidates({ title: 'Zażółć gęślą jaźń' }).map(
          (candidate) => candidate.text,
        ),
      ).toEqual([
        'zażółć gęślą jaźń',
        'zażółć gęślą',
        'gęślą jaźń',
        'zażółć',
        'gęślą',
        'jaźń',
      ]);
      expect(
        extractCandidates({ title: 'हिंदी मौसम' }).map(
          (candidate) => candidate.text,
        ),
      ).toEqual(['हिंदी मौसम', 'हिंदी', 'मौसम']);
    });
  });
});
