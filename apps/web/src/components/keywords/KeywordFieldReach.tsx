"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  type AppStoreLocalization,
  storefrontsReading,
} from "@asobeast/shared";
import { formatCountry } from "@/lib/format";
import { keywordCountriesOptions } from "@/lib/queries";

export function KeywordFieldReach({
  id,
  market,
  localization,
  untracked,
}: {
  id: string;
  market: string;
  localization: AppStoreLocalization | undefined;
  untracked: string[];
}) {
  const { data: countries } = useSuspenseQuery(keywordCountriesOptions(id));
  const readers = localization
    ? storefrontsReading(
        localization,
        countries.map((entry) => entry.country),
      )
    : [];
  if (readers.length < 2 && untracked.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 text-caption text-muted-foreground">
      {readers.length > 1 ? (
        <p>
          Read in {readers.map(formatCountry).join(", ")}. Saving here tracks
          its phrases in {formatCountry(market)}.
        </p>
      ) : null}
      {untracked.length > 0 ? (
        <p>
          Not tracked in {formatCountry(market)}: {untracked.join(", ")}. Save
          the field to track them here.
        </p>
      ) : null}
    </div>
  );
}
