"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@/lib/locale";
import { navigateToLocale } from "@/lib/locale-cookie";

const LANGUAGE_NAMES: Readonly<Record<Locale, string>> = {
  en: "English",
  "zh-CN": "简体中文",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale();
  const locale = isLocale(current) ? current : DEFAULT_LOCALE;
  const t = useTranslations("common");

  return (
    <Select
      value={locale}
      onValueChange={(value) => {
        if (isLocale(value)) navigateToLocale(value);
      }}
    >
      <SelectTrigger aria-label={t("language")} size="sm" className={className}>
        <SelectValue>{LANGUAGE_NAMES[locale]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((option) => (
          <SelectItem key={option} value={option}>
            {LANGUAGE_NAMES[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
