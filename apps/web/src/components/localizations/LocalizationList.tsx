"use client";

import { useQueryState } from "nuqs";
import {
  isAppStoreLocalization,
  type AppLocalizationsResult,
  type AppStoreLocalization,
} from "@asobeast/shared";
import { focusDraftLocalization } from "@/components/metadata/DraftLocalizationSelect";
import { Accordion } from "@/components/ui/accordion";
import { openLocalization } from "@/lib/app-localizations";
import { draftableLocalizations, storefrontRows } from "@/lib/localizations";
import { draftLocaleParser, fieldLocaleParser } from "@/lib/search-params";
import { LocalizationItem } from "./LocalizationItem";

export function LocalizationList({
  id,
  result,
  canDraft,
}: {
  id: string;
  result: AppLocalizationsResult;
  canDraft: boolean;
}) {
  const [requested, setRequested] = useQueryState(
    "fieldLocale",
    fieldLocaleParser,
  );
  const [, setDraftLocale] = useQueryState("draftLocale", draftLocaleParser);
  const draftable = new Set(
    draftableLocalizations(storefrontRows(result.home, result.markets)),
  );
  const draft = (localization: AppStoreLocalization) => {
    void setDraftLocale(localization).then(focusDraftLocalization);
  };

  return (
    <Accordion
      type="single"
      collapsible={result.localizations.length > 1}
      value={openLocalization(result.localizations, requested)}
      onValueChange={(next) =>
        void setRequested(isAppStoreLocalization(next) ? next : null, {
          history: "replace",
        })
      }
      className="rounded-lg border border-border px-3"
    >
      {result.localizations.map((item) => (
        <LocalizationItem
          key={item.localization}
          id={id}
          item={item}
          onDraft={canDraft && draftable.has(item.localization) ? draft : null}
        />
      ))}
    </Accordion>
  );
}
