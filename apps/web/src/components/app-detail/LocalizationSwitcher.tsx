"use client";

import {
  isAppStoreLocalization,
  storefrontLocalizations,
} from "@asobeast/shared";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localizationNameInLocale } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import { useLocalization } from "./use-localization";

const DEFAULT_VALUE = "default";

export function LocalizationSwitcher({ id }: { id: string }) {
  const { market, captured, localization, select } = useLocalization(id);
  const t = useTranslations("appDetail");
  const locale = useAppLocale();
  if (captured.length === 0) return null;
  const primary = storefrontLocalizations(market)?.primary;
  const defaultLabel = t("switchers.defaultLocalization", {
    name: primary
      ? localizationNameInLocale(primary, locale)
      : market.toUpperCase(),
  });
  const value = localization ?? DEFAULT_VALUE;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Label htmlFor={`localization-${id}`}>
        {t("switchers.localization")}
      </Label>
      <Select
        value={value}
        onValueChange={(next) =>
          select(isAppStoreLocalization(next) ? next : null)
        }
      >
        <SelectTrigger id={`localization-${id}`} className="w-[240px]">
          <SelectValue>
            {localization === null
              ? defaultLabel
              : localizationNameInLocale(localization, locale)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_VALUE}>{defaultLabel}</SelectItem>
          {captured.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {localizationNameInLocale(tag, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
