import { isStopword } from '@asobeast/shared';

const JAPANESE = ['アプリ', '無料', '公式', 'ダウンロード'];

const CHINESE = [
  '应用',
  '應用',
  '免费',
  '免費',
  '官方',
  '下载',
  '下載',
  '一个',
  '一個',
  '我们',
  '我們',
  '什么',
  '什麼',
  '我的',
  '你的',
];

const CHINESE_PARTICLES: ReadonlySet<string> = new Set([
  '的',
  '了',
  '是',
  '在',
  '和',
  '与',
  '與',
  '及',
  '或',
  '让',
  '讓',
  '你',
  '我',
  '他',
  '她',
  '都',
  '也',
  '就',
  '很',
  '把',
  '被',
  '给',
  '給',
  '从',
  '從',
  '对',
  '對',
  '为',
  '為',
]);
const THAI = [
  'แอป',
  'แอปพลิเคชัน',
  'ฟรี',
  'และ',
  'ที่',
  'ที่สุด',
  'ของ',
  'ใน',
  'กับ',
  'หรือ',
  'ได้',
  'ให้',
  'เป็น',
  'มาก',
  'ทุก',
  'จาก',
];

const ARABIC = [
  'في',
  'من',
  'على',
  'إلى',
  'الى',
  'عن',
  'مع',
  'هذا',
  'هذه',
  'ذلك',
  'التي',
  'الذي',
  'أو',
  'او',
  'ثم',
  'كل',
  'هو',
  'هي',
  'أن',
  'ان',
  'إن',
  'لا',
  'ما',
  'قد',
  'بعد',
  'قبل',
  'بين',
  'حتى',
  'عند',
  'أكثر',
  'اكثر',
  'أفضل',
  'افضل',
  'الأفضل',
  'مجاني',
  'مجانية',
  'مجانا',
  'تطبيق',
  'تطبيقات',
  'التطبيق',
  'رسمي',
  'جديد',
  'تحميل',
];

const ARABIC_CONJUNCTION = 'و';

const ARABIC_WORDS: ReadonlySet<string> = new Set(ARABIC);
const EXTRACTION_STOPWORDS: ReadonlySet<string> = new Set([
  ...JAPANESE,
  ...CHINESE,
  ...THAI,
  ...ARABIC,
]);

const isConjoinedArabicStopword = (token: string): boolean =>
  token.startsWith(ARABIC_CONJUNCTION) &&
  ARABIC_WORDS.has(token.slice(ARABIC_CONJUNCTION.length));

const ARABIC_DECORATION = /\u0640|\u0670|[\u064B-\u065F]/gu;

export const isExtractionStopword = (token: string): boolean => {
  const word = token.replace(ARABIC_DECORATION, '');
  return (
    isStopword(word) ||
    EXTRACTION_STOPWORDS.has(word) ||
    isConjoinedArabicStopword(word)
  );
};

export const isChineseParticle = (word: string): boolean =>
  CHINESE_PARTICLES.has(word);
