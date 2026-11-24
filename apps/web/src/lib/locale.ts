export const LOCALES = ["en", "zh-CN"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE_NAME = "asobeast_locale";

export function isLocale(value: string): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

function localeForTag(tag: string): Locale | null {
  const normalized = tag.trim().toLowerCase();
  if (
    normalized === "zh" ||
    normalized === "zh-cn" ||
    normalized === "zh-hans"
  ) {
    return "zh-CN";
  }
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

function acceptedTags(acceptLanguage: string): string[] {
  return acceptLanguage
    .split(",")
    .map((entry, index) => {
      const [tag = "", ...parameters] = entry.trim().split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().toLowerCase().startsWith("q="),
      );
      const quality = qualityParameter
        ? Number(qualityParameter.trim().slice(2))
        : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter(({ quality }) => quality > 0)
    .sort(
      (left, right) => right.quality - left.quality || left.index - right.index,
    )
    .map(({ tag }) => tag);
}

export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (cookieValue !== undefined && isLocale(cookieValue)) return cookieValue;
  if (acceptLanguage === null) return DEFAULT_LOCALE;
  for (const tag of acceptedTags(acceptLanguage)) {
    const locale = localeForTag(tag);
    if (locale !== null) return locale;
  }
  return DEFAULT_LOCALE;
}
