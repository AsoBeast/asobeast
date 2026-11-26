import { useLocale } from "next-intl";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale";

export function useAppLocale(): Locale {
  const locale = useLocale();
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}
