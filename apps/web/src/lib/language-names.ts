import enLanguages from "../../messages/en/languages.json";
import zhLanguages from "../../messages/zh-CN/languages.json";
import type { Locale } from "./locale";

const LANGUAGE_NAMES_BY_LOCALE = {
  en: enLanguages.names,
  "zh-CN": zhLanguages.names,
} as const;

export const LANGUAGE_NAMES: Readonly<Record<string, string>> =
  LANGUAGE_NAMES_BY_LOCALE.en;

export function languageName(tag: string, locale: Locale = "en"): string {
  const language = tag.split("-")[0]?.toLowerCase() ?? tag;
  const names: Readonly<Record<string, string>> =
    LANGUAGE_NAMES_BY_LOCALE[locale];
  return names[language] ?? tag;
}
