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
  'ثم',
  'كل',
  'هو',
  'هي',
  'أن',
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
  'مجاني',
  'مجانا',
  'تطبيق',
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

export const isExtractionStopword = (token: string): boolean =>
  isStopword(token) ||
  EXTRACTION_STOPWORDS.has(token) ||
  isConjoinedArabicStopword(token);
