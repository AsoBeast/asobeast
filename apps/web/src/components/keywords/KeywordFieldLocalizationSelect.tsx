"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import {
  type AppStoreLocalization,
  isAppStoreLocalization,
} from "@asobeast/shared";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fieldLocalization, fieldLocalizations } from "@/lib/keyword-field";
import { localizationName } from "@/lib/localizations";
import { keywordFieldsOptions } from "@/lib/queries";
import { fieldLocaleParser } from "@/lib/search-params";

export function KeywordFieldLocalizationSelect({
  id,
  home,
  market,
}: {
  id: string;
  home: string;
  market: string;
}) {
  const [requested, setRequested] = useQueryState(
    "fieldLocale",
    fieldLocaleParser,
  );
  const { data: saved } = useSuspenseQuery(keywordFieldsOptions(id));
  const read = fieldLocalizations(home, market);
  if (read.length < 2) return null;
  const chosen = fieldLocalization(home, market, requested);
  const savedTags = new Set(saved.map((field) => field.localization));
  const label = (tag: AppStoreLocalization) =>
    [
      localizationName(tag),
      tag === read[0] ? "default" : null,
      savedTags.has(tag) ? "saved" : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={`keyword-field-localization-${id}`}>Localization</Label>
      <Select
        value={chosen}
        onValueChange={(next) =>
          void setRequested(
            isAppStoreLocalization(next) && next !== read[0] ? next : null,
          )
        }
      >
        <SelectTrigger
          id={`keyword-field-localization-${id}`}
          className="w-[260px]"
        >
          <SelectValue>{chosen ? label(chosen) : null}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {read.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {label(tag)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
