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

const EXTRACTION_STOPWORDS: ReadonlySet<string> = new Set([
  ...JAPANESE,
  ...CHINESE,
  ...THAI,
]);

export const isExtractionStopword = (token: string): boolean =>
  isStopword(token) || EXTRACTION_STOPWORDS.has(token);
