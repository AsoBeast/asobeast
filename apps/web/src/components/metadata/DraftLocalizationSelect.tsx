"use client";

import { useId } from "react";
import { useQueryState } from "nuqs";
import {
  APP_STORE_LOCALIZATIONS,
  isAppStoreLocalization,
} from "@asobeast/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { draftableLocalizations } from "@/lib/localizations";
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
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={DRAFT_LOCALIZATION_ID}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Localization
      </label>
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
          <SelectItem value={PRIMARY_LISTING}>Primary listing</SelectItem>
          {options.map((localization) => (
            <SelectItem key={localization} value={localization}>
              {APP_STORE_LOCALIZATIONS[localization]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {draftLocale ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          Drafts are written in {APP_STORE_LOCALIZATIONS[draftLocale]}. To fill
          its keyword field with keywords in another language instead, say so in
          the instructions.
        </p>
      ) : null}
    </div>
  );
}
