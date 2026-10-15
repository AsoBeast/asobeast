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

export function replyLanguageName(tag: string): string {
  const primary = tag.split(/[-_]/)[0]?.toLowerCase() ?? "";
  return LANGUAGE_NAMES[primary] ?? tag;
}
