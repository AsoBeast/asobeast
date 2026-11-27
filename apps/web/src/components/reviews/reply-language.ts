import type { Locale } from "@/lib/locale";

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  da: "Danish",
  de: "German",
  en: "English",
  es: "Spanish",
  fi: "Finnish",
  fr: "French",
  hi: "Hindi",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  nb: "Norwegian",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
  ru: "Russian",
  sv: "Swedish",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  vi: "Vietnamese",
  zh: "Chinese",
};

const LANGUAGE_NAMES_ZH: Record<string, string> = {
  ar: "阿拉伯语",
  da: "丹麦语",
  de: "德语",
  en: "英语",
  es: "西班牙语",
  fi: "芬兰语",
  fr: "法语",
  hi: "印地语",
  id: "印尼语",
  it: "意大利语",
  ja: "日语",
  ko: "韩语",
  nb: "挪威语",
  nl: "荷兰语",
  pl: "波兰语",
  pt: "葡萄牙语",
  ru: "俄语",
  sv: "瑞典语",
  th: "泰语",
  tr: "土耳其语",
  uk: "乌克兰语",
  vi: "越南语",
  zh: "中文",
};

export function replyLanguageName(tag: string, locale: Locale = "en"): string {
  const primary = tag.split(/[-_]/)[0]?.toLowerCase() ?? "";
  const names = locale === "zh-CN" ? LANGUAGE_NAMES_ZH : LANGUAGE_NAMES;
  return Object.hasOwn(names, primary) ? names[primary] : tag;
}
