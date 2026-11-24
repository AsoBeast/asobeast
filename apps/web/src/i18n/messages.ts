import type { Locale } from "@/lib/locale";

import enAuth from "../../messages/en/auth.json";
import enCommon from "../../messages/en/common.json";
import enCountries from "../../messages/en/countries.json";
import enErrors from "../../messages/en/errors.json";
import enNavigation from "../../messages/en/navigation.json";
import zhAuth from "../../messages/zh-CN/auth.json";
import zhCommon from "../../messages/zh-CN/common.json";
import zhCountries from "../../messages/zh-CN/countries.json";
import zhErrors from "../../messages/zh-CN/errors.json";
import zhNavigation from "../../messages/zh-CN/navigation.json";

export const messageNamespaces = [
  "common",
  "navigation",
  "auth",
  "errors",
  "countries",
] as const;

const catalogs: Record<Locale, Record<string, unknown>> = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    auth: enAuth,
    errors: enErrors,
    countries: enCountries,
  },
  "zh-CN": {
    common: zhCommon,
    navigation: zhNavigation,
    auth: zhAuth,
    errors: zhErrors,
    countries: zhCountries,
  },
};

export async function loadMessages(
  locale: Locale,
): Promise<Record<string, unknown>> {
  return catalogs[locale];
}
