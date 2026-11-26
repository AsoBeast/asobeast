import type { Locale } from "@/lib/locale";

import enAccount from "../../messages/en/account.json";
import enAuth from "../../messages/en/auth.json";
import enBilling from "../../messages/en/billing.json";
import enCommon from "../../messages/en/common.json";
import enCountries from "../../messages/en/countries.json";
import enErrors from "../../messages/en/errors.json";
import enFormat from "../../messages/en/format.json";
import enLegal from "../../messages/en/legal.json";
import enNavigation from "../../messages/en/navigation.json";
import enSeo from "../../messages/en/seo.json";
import enShell from "../../messages/en/shell.json";
import enSystemNotices from "../../messages/en/systemNotices.json";
import enUi from "../../messages/en/ui.json";
import enValidation from "../../messages/en/validation.json";
import zhAccount from "../../messages/zh-CN/account.json";
import zhAuth from "../../messages/zh-CN/auth.json";
import zhBilling from "../../messages/zh-CN/billing.json";
import zhCommon from "../../messages/zh-CN/common.json";
import zhCountries from "../../messages/zh-CN/countries.json";
import zhErrors from "../../messages/zh-CN/errors.json";
import zhFormat from "../../messages/zh-CN/format.json";
import zhLegal from "../../messages/zh-CN/legal.json";
import zhNavigation from "../../messages/zh-CN/navigation.json";
import zhSeo from "../../messages/zh-CN/seo.json";
import zhShell from "../../messages/zh-CN/shell.json";
import zhSystemNotices from "../../messages/zh-CN/systemNotices.json";
import zhUi from "../../messages/zh-CN/ui.json";
import zhValidation from "../../messages/zh-CN/validation.json";

export const messageNamespaces = [
  "common",
  "navigation",
  "auth",
  "errors",
  "countries",
  "ui",
  "format",
  "shell",
  "systemNotices",
  "validation",
  "legal",
  "billing",
  "account",
  "seo",
] as const;

export const catalogs: Record<Locale, Record<string, unknown>> = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    auth: enAuth,
    errors: enErrors,
    countries: enCountries,
    ui: enUi,
    format: enFormat,
    shell: enShell,
    systemNotices: enSystemNotices,
    validation: enValidation,
    legal: enLegal,
    billing: enBilling,
    account: enAccount,
    seo: enSeo,
  },
  "zh-CN": {
    common: zhCommon,
    navigation: zhNavigation,
    auth: zhAuth,
    errors: zhErrors,
    countries: zhCountries,
    ui: zhUi,
    format: zhFormat,
    shell: zhShell,
    systemNotices: zhSystemNotices,
    validation: zhValidation,
    legal: zhLegal,
    billing: zhBilling,
    account: zhAccount,
    seo: zhSeo,
  },
};

export async function loadMessages(
  locale: Locale,
): Promise<Record<string, unknown>> {
  return catalogs[locale];
}
