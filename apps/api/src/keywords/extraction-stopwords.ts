import {
  ARABIC_DECORATION,
  ARABIC_FUNCTION_WORDS,
  CHINESE_FUNCTION_WORDS,
  CHINESE_PARTICLES,
  isStopword,
  THAI_FUNCTION_WORDS,
} from '@asobeast/shared';

const JAPANESE_NOISE = ['アプリ', '無料', '公式', 'ダウンロード'];

const CHINESE_NOISE = ['应用', '應用', '免费', '免費', '官方', '下载', '下載'];

const THAI_NOISE = ['แอป', 'แอพ', 'แอปพลิเคชัน', 'ฟรี', 'วันนี้'];

const THAI_PREFIXES: ReadonlySet<string> = new Set(['การ', 'ความ', 'นัก', 'ผู้']);

const ARABIC_NOISE = [
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

const ARABIC_WORDS: ReadonlySet<string> = new Set([
  ...ARABIC_FUNCTION_WORDS,
  ...ARABIC_NOISE,
]);
const STORE_NOISE: ReadonlySet<string> = new Set([
  ...JAPANESE_NOISE,
  ...CHINESE_NOISE,
  ...THAI_NOISE,
]);
const EXTRACTION_STOPWORDS: ReadonlySet<string> = new Set([
  ...STORE_NOISE,
  ...CHINESE_FUNCTION_WORDS,
  ...THAI_FUNCTION_WORDS,
  ...THAI_PREFIXES,
  ...ARABIC_WORDS,
]);

export const isStoreNoise = (word: string): boolean => STORE_NOISE.has(word);

const isConjoinedArabicStopword = (token: string): boolean =>
  token.startsWith(ARABIC_CONJUNCTION) &&
  ARABIC_WORDS.has(token.slice(ARABIC_CONJUNCTION.length));

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

export const isThaiPrefix = (word: string): boolean => THAI_PREFIXES.has(word);
