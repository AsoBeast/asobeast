"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { Store } from "@asobeast/shared";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_OPTIONS, OTHER, marketError } from "@/lib/countries";
import { formatCountryInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { useAppLocale } from "@/lib/use-app-locale";

const countryLabel = (code: string, locale: Locale) =>
  `${code.toUpperCase()} · ${formatCountryInLocale(code, locale)}`;

export function CountrySelect({
  id,
  store,
  value,
  onChange,
  ariaLabel,
}: {
  id?: string;
  store: Store;
  value: string;
  onChange: (code: string) => void;
  ariaLabel?: string;
}) {
  const errorId = useId();
  const locale = useAppLocale();
  const t = useTranslations("ui");
  const validation = useTranslations("validation");
  const other = value === "" || !COUNTRY_OPTIONS.includes(value);
  const error =
    other && value.length === 2 ? marketError(store, value, validation) : null;

  return (
    <div data-slot="country-select" className="flex flex-col gap-2">
      <Select
        value={other ? OTHER : value}
        onValueChange={(next) => onChange(next === OTHER ? "" : next)}
      >
        <SelectTrigger
          id={id}
          data-slot="country-select-trigger"
          aria-label={ariaLabel}
          className="w-[220px]"
        >
          <SelectValue>
            {other ? t("other") : countryLabel(value, locale)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_OPTIONS.map((code) => (
            <SelectItem key={code} value={code}>
              {countryLabel(code, locale)}
            </SelectItem>
          ))}
          <SelectItem value={OTHER} data-action="other-country">
            {t("other")}
          </SelectItem>
        </SelectContent>
      </Select>
      {other ? (
        <Input
          data-action="country-code"
          aria-label={t("storefrontCountryCode")}
          value={value}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
          placeholder={t("countryCodePlaceholder")}
          maxLength={2}
          className="w-[220px]"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
        />
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
