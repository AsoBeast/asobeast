export const OCR_LANGUAGES = [
  'eng',
  'deu',
  'fra',
  'spa',
  'por',
  'ita',
  'jpn',
  'kor',
  'chi_sim',
  'chi_tra',
  'rus',
  'ara',
  'tha',
] as const;

export type OcrLanguage = (typeof OCR_LANGUAGES)[number];

export const DEFAULT_OCR_LANGUAGES: OcrLanguage[] = [...OCR_LANGUAGES];

export const OCR_RECIPE_VERSION = 'ocr2';

const STOREFRONT_LANGUAGE: Readonly<Record<string, OcrLanguage>> = {
  jp: 'jpn',
  kr: 'kor',
  cn: 'chi_sim',
  tw: 'chi_tra',
  hk: 'chi_tra',
  mo: 'chi_tra',
  ru: 'rus',
  by: 'rus',
  kz: 'rus',
  ae: 'ara',
  sa: 'ara',
  eg: 'ara',
  qa: 'ara',
  kw: 'ara',
  bh: 'ara',
  om: 'ara',
  jo: 'ara',
  lb: 'ara',
  dz: 'ara',
  ma: 'ara',
  tn: 'ara',
  iq: 'ara',
  ye: 'ara',
  th: 'tha',
  de: 'deu',
  at: 'deu',
  ch: 'deu',
  fr: 'fra',
  be: 'fra',
  lu: 'fra',
  es: 'spa',
  mx: 'spa',
  ar: 'spa',
  cl: 'spa',
  co: 'spa',
  pe: 'spa',
  ve: 'spa',
  ec: 'spa',
  uy: 'spa',
  py: 'spa',
  bo: 'spa',
  cr: 'spa',
  do: 'spa',
  gt: 'spa',
  hn: 'spa',
  ni: 'spa',
  pa: 'spa',
  sv: 'spa',
  br: 'por',
  pt: 'por',
  it: 'ita',
};

export function ocrLanguagesFor(
  country: string,
  enabled: readonly OcrLanguage[],
): OcrLanguage[] {
  const native = STOREFRONT_LANGUAGE[country.toLowerCase()];
  const wanted: OcrLanguage[] = native ? ['eng', native] : ['eng'];
  return wanted.filter((language) => enabled.includes(language));
}

export const ocrRecipe = (languages: readonly OcrLanguage[]): string =>
  `${OCR_RECIPE_VERSION}:${languages.join('+')}`;
