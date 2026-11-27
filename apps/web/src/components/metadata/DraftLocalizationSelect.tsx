"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { isAppStoreLocalization } from "@asobeast/shared";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  localizationNameInLocale,
  draftableLocalizations,
} from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import { draftLocaleParser } from "@/lib/search-params";
import { useStorefrontRows } from "./use-storefront-rows";

export const DRAFT_LOCALIZATION_ID = "draft-localization";

const PRIMARY_LISTING = "primary";

export function focusDraftLocalization(): void {
  const trigger = document.getElementById(DRAFT_LOCALIZATION_ID);
  trigger?.scrollIntoView({ block: "center" });
  trigger?.focus({ preventScroll: true });
}

export function DraftLocalizationSelect({ appId }: { appId: string }) {
  const t = useTranslations("metadata");
  const locale = useAppLocale();
  const hintId = useId();
  const draftable = draftableLocalizations(useStorefrontRows(appId));
  const [draftLocale, setDraftLocale] = useQueryState(
    "draftLocale",
    draftLocaleParser,
  );
  const options =
    draftLocale === null || draftable.includes(draftLocale)
      ? draftable
      : [...draftable, draftLocale];
  if (options.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={DRAFT_LOCALIZATION_ID}>
        {t("draftLocalization.label")}
      </Label>
      <Select
        value={draftLocale ?? PRIMARY_LISTING}
        onValueChange={(next) =>
          void setDraftLocale(isAppStoreLocalization(next) ? next : null)
        }
      >
        <SelectTrigger
          id={DRAFT_LOCALIZATION_ID}
          aria-describedby={draftLocale ? hintId : undefined}
          className="w-full sm:w-72"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PRIMARY_LISTING}>
            {t("draftLocalization.primary")}
          </SelectItem>
          {options.map((localization) => (
            <SelectItem key={localization} value={localization}>
              {localizationNameInLocale(localization, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {draftLocale ? (
        <p id={hintId} className="text-caption text-muted-foreground">
          {t("draftLocalization.hint", {
            language: localizationNameInLocale(draftLocale, locale),
          })}
        </p>
      ) : null}
    </div>
  );
}
