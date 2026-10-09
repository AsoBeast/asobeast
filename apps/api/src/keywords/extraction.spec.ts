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

    it('keeps the pieces of an unknown katakana word together', () => {
      expect(texts({ title: 'ウマ娘 プリティーダービー' })).toEqual([
        'ウマ娘',
        'プリティーダービー',
        'ウマ',
        'プリティー',
        'ダービー',
      ]);
      expect(texts({ title: 'ワルキューレ' })).toEqual(['ワルキューレ']);
      expect(texts({ title: 'ダンジョン' })).toEqual(['ダンジョン']);
      expect(texts({ title: 'メダロットサバイバー' })).toEqual([
        'メダロットサバイバー',
      ]);
    });

    it('keeps a brand together when the segmenter splits it into characters', () => {
      expect(texts({ title: '微信' })).toEqual(['微信']);
      expect(texts({ title: '淘宝 - 小红书' })).toEqual([
        '小红书',
        '淘宝',
        '小红',
      ]);
    });

    it('keeps a one character han word inside the compound it ends', () => {
      expect(texts({ title: '家計簿アプリで簡単管理' })).toEqual([
        '家計簿',
        '簡単管理',
        '家計',
        '簡単',
        '管理',
      ]);
      expect(texts({ title: '歩数計と体重記録' })).toEqual([
        '歩数計',
        '体重記録',
        '歩数',
        '体重',
        '記録',
      ]);
      expect(texts({ title: '英単語帳で暗記' })).toEqual([
        '英単語帳',
        '英単語',
        '暗記',
      ]);
      expect(texts({ title: '翻译器支持多种语言' })).toEqual([
        '翻译器支持',
        '支持多种语言',
        '翻译器',
        '支持多种',
        '多种语言',
        '翻译',
        '支持',
        '多种',
        '语言',
      ]);
    });

    it('never starts a phrase with a one character han word or a particle', () => {
      expect(texts({ title: '我的记账本和钱包' })).toEqual([
        '记账本',
        '记账',
        '钱包',
      ]);
      expect(texts({ title: '朋友的照片' })).toEqual(['朋友', '照片']);
    });

    it('keeps a short chinese title that starts with a pronoun', () => {
      expect(texts({ title: '我的世界' })).toEqual(['世界', '我的世界']);
      expect(texts({ title: '我的汤姆猫' })).toContain('我的汤姆猫');
    });

    it('reads chinese particle characters as words in japanese text', () => {
      expect(texts({ title: '就活準備アプリ' })).toEqual([
        '就活準備',
        '就活',
        '準備',
      ]);
      expect(texts({ title: '東京都防災アプリ' })).toEqual([
        '東京都防災',
        '東京都',
        '東京',
        '防災',
      ]);
      expect(texts({ title: '東京都公式アプリ' })).toEqual(['東京都', '東京']);
    });

    it('keeps the chinese word for online together', () => {
      expect(texts({ title: '在线教育平台' })).toEqual([
        '在线教育平台',
        '在线教育',
        '教育平台',
        '在线',
        '教育',
        '平台',
      ]);
    });

    it('lets a one character han word start a phrase only at the start of a chunk', () => {
      expect(texts({ title: '新機能で便利に' })).toEqual([
        '新機能',
        '機能',
        '便利',
      ]);
      expect(texts({ title: '筋トレ記録' })).toEqual([
        '筋トレ記録',
        '筋トレ',
        'トレ記録',
        'トレ',
        '記録',
      ]);
      expect(texts({ title: 'iPhone用カメラアプリ' })).toEqual([
        'iphone',
        'カメラ',
      ]);
    });

    it('does not keep a short sentence with a grammar word whole', () => {
      expect(texts({ title: '猫のゲーム' })).toEqual(['ゲーム']);
      expect(texts({ title: '毎日の記録' })).toEqual(['毎日', '記録']);
      expect(texts({ title: '新闻与资讯' })).toEqual(['新闻', '资讯']);
      expect(texts({ title: '为你推荐' })).toEqual(['推荐']);
    });

    it('offers the words of a short run as well as the run', () => {
      expect(texts({ title: '天気予報' })).toEqual([
        '天気予報',
        '天気',
        '予報',
      ]);
      expect(texts({ title: '超级计算器' })).toEqual([
        '超级计算器',
        '超级计算',
        '计算器',
        '超级',
        '计算',
      ]);
      expect(texts({ title: '老年人手机' })).toEqual([
        '老年人手机',
        '老年人',
        '手机',
      ]);
      expect(texts({ title: '高德地图' })).toEqual([
        '高德地图',
        '高德',
        '地图',
      ]);
      expect(texts({ title: 'ぐるなび' })).toEqual(['ぐるなび']);
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
        { text: '朋友畅聊', source: 'SUBTITLE', weight: 2 },
        { text: '随时', source: 'SUBTITLE', weight: 2 },
        { text: '随地', source: 'SUBTITLE', weight: 2 },
        { text: '朋友', source: 'SUBTITLE', weight: 2 },
        { text: '畅聊', source: 'SUBTITLE', weight: 2 },
      ]);
    });

    it('splits a thai listing into words and drops thai noise words', () => {
      expect(
        extractCandidates({
          title: 'Grab - แอปสั่งอาหาร',
          subtitle: 'สั่งอาหารและร้านอาหารที่ใหญ่ที่สุด',
        }),
      ).toEqual([
        { text: 'grab', source: 'TITLE', weight: 3 },
        { text: 'สั่งอาหาร', source: 'TITLE', weight: 3 },
        { text: 'ร้านอาหาร', source: 'SUBTITLE', weight: 2 },
        { text: 'ใหญ่', source: 'SUBTITLE', weight: 2 },
      ]);
    });

    it('measures a thai phrase in letters with their marks', () => {
      expect(texts({ title: 'ธนาคารออนไลน์' })).toEqual([
        'ธนาคารออนไลน์',
        'ธนาคาร',
        'ออนไลน์',
      ]);
      expect(texts({ title: 'สั่งอาหารออนไลน์' })).toEqual([
        'สั่งอาหารออนไลน์',
        'สั่งอาหาร',
        'ออนไลน์',
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
        { text: '写真加工', source: 'TITLE', weight: 3 },
        { text: 'photo', source: 'TITLE', weight: 3 },
        { text: 'editor', source: 'TITLE', weight: 3 },
        { text: '写真', source: 'TITLE', weight: 3 },
        { text: '加工', source: 'TITLE', weight: 3 },
        { text: 'iphone', source: 'SUBTITLE', weight: 2 },
        { text: 'カメラ', source: 'SUBTITLE', weight: 2 },
      ]);
    });

    it('does not join words across a space, a dash or punctuation', () => {
      expect(texts({ title: 'メルカリ フリマアプリ' })).toEqual([
        'メルカリ',
        'フリマアプリ',
      ]);
      expect(texts({ title: 'Yahoo!乗換案内' })).toEqual([
        '乗換案内',
        'yahoo',
        '乗換',
        '案内',
      ]);
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

    it('drops a decorated arabic stopword but keeps the written form of a word', () => {
      expect(texts({ title: 'كريم - توصيل طعام وأكـثر' })).toEqual([
        'كريم توصيل طعام',
        'كريم توصيل',
        'توصيل طعام',
        'كريم',
        'توصيل',
        'طعام',
      ]);
      expect(texts({ title: 'مَطْعَم أَكْثَر' })).toEqual(['مَطْعَم']);
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

  describe('thai listings', () => {
    const texts = (input: Parameters<typeof extractCandidates>[0]): string[] =>
      extractCandidates(input).map((candidate) => candidate.text);

    it('tracks the words of a thai google play listing, not fragments across them', () => {
      expect(
        texts({
          title: 'Grab: แท็กซี่ และ แอปสั่งอาหาร',
          summary:
            'เดินทางด้วยความอุ่นใจ จองการเดินทางไปสนามบินล่วงหน้ากับ Grab วันนี้',
        }),
      ).toEqual([
        'grab',
        'แท็กซี่',
        'สั่งอาหาร',
        'จองการเดินทาง',
        'สนามบินล่วงหน้า',
        'เดินทาง',
        'ความอุ่นใจ',
        'จอง',
        'การเดินทาง',
        'สนามบิน',
        'ล่วงหน้า',
      ]);
    });

    it.each([
      ['ร้านขายยาออนไลน์', ['ร้านขาย', 'ยาออนไลน์']],
      ['โรงพยาบาลสัตว์ ใกล้ฉัน', ['พยาบาลสัตว์', 'โรง', 'พยาบาล']],
      ['นัดหมายสัตวแพทย์', ['หมายสัตวแพทย์']],
      ['ตรวจผลสลากกินแบ่งรัฐบาล', ['ผลสลากกิน', 'สลากกิน', 'กินแบ่ง']],
      ['ฤกษ์มงคลประจำปี', ['มงคลประจำ']],
      ['แปลภาษาออฟไลน์', ['ภาษาออฟ', 'ออฟ']],
      ['เครื่องสำอาง ความงาม', ['เครื่อง', 'สำอาง', 'ความ', 'งาม']],
      ['ช้อปออนไลน์ ส่งฟรี', ['ช้อปออน', 'ปออนไลน์', 'ช้อ']],
      ['สั่งอาหารเดลิเวอรี่', ['สั่งอา', 'อาหารเดลิ', 'เดลิเว']],
      ['ดูดวงรายวัน แม่นๆ', ['ดูด', 'วงรายวัน', 'ดูดวงราย']],
      ['สกินแคร์ บำรุงผิวหน้า', ['สกิน']],
      ['สวยๆๆ เยอะๆๆ', ['สว', 'ยๆๆ', 'เย', 'อะๆๆ']],
    ])('never cuts through a word of %s', (title, fragments) => {
      expect(
        texts({ title }).filter((text) => fragments.includes(text)),
      ).toEqual([]);
    });

    it('ends a thai phrase at a function word', () => {
      expect(texts({ title: 'เดินทางด้วยความอุ่นใจ' })).toEqual([
        'เดินทาง',
        'ความอุ่นใจ',
      ]);
      expect(texts({ title: 'ไม่ต้องใช้อุปกรณ์' })).toEqual([
        'ใช้อุปกรณ์',
        'ใช้',
        'อุปกรณ์',
      ]);
    });

    it('keeps a word that starts with a nominalizing prefix whole', () => {
      expect(texts({ title: 'ความสวยความงาม' })).toEqual([
        'ความสวยความงาม',
        'ความสวย',
        'ความงาม',
      ]);
    });
  });
});
