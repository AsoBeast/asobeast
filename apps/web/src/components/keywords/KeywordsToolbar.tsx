"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Download, Plus, X } from "lucide-react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { formatCountry } from "@/lib/format";
import { keywordCountriesOptions, keywordsOptions } from "@/lib/queries";
import { countryParser, sortParser } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { AddKeywordsDialog } from "./AddKeywordsDialog";
import { exportKeywords } from "./keyword-csv";

export function KeywordsToolbar({
  id,
  market,
  homeCountry,
}: {
  id: string;
  market: string;
  homeCountry: string;
}) {
  const [, setCountry] = useQueryState("country", countryParser);
  const [sort] = useQueryState("sort", sortParser);
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));
  const { data: keywords } = useSuspenseQuery(
    keywordsOptions(id, sort, market),
  );

  const total = markets.reduce((sum, entry) => sum + entry.keywordCount, 0);
  const active = keywords.filter((keyword) => keyword.active).length;
  const partial = keywords.length !== total;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Keyword markets"
        className="flex flex-wrap items-center gap-2"
      >
        {markets.map((entry) => {
          const selected = entry.country === market;
          return (
            <button
              key={entry.country}
              type="button"
              aria-pressed={selected}
              title={formatCountry(entry.country)}
              onClick={() => void setCountry(entry.country)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-body transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "hover:bg-muted",
              )}
            >
              <span className="font-medium">{entry.country.toUpperCase()}</span>
              <span className="numeric font-mono text-caption opacity-70">
                {entry.keywordCount}
              </span>
            </button>
          );
        })}
        <AddKeywordsDialog appId={id} country={market}>
          <Button variant="outline" size="sm" aria-label="Add a market">
            <Plus />
          </Button>
        </AddKeywordsDialog>
      </div>

      {market !== homeCountry ? (
        <button
          type="button"
          onClick={() => void setCountry(null)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-caption hover:bg-muted"
        >
          Market: {market.toUpperCase()}
          <X className="size-3 opacity-60" aria-hidden />
          <span className="sr-only">Clear the market filter</span>
        </button>
      ) : null}

      <p className="text-body text-muted-foreground" aria-live="polite">
        Tracking{" "}
        <span className="numeric font-mono font-medium text-foreground">
          {keywords.length}
        </span>
        {partial ? (
          <>
            {" of "}
            <span className="numeric font-mono font-medium text-foreground">
              {total}
            </span>
          </>
        ) : null}{" "}
        keyword{keywords.length === 1 ? "" : "s"} ·{" "}
        <span className="numeric font-mono font-medium text-foreground">
          {active}
        </span>{" "}
        active
      </p>

      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        disabled={keywords.length === 0}
        onClick={() => exportKeywords(id, keywords)}
        aria-label="Export keywords to CSV"
      >
        <Download />
        Export CSV
      </Button>
    </div>
  );
}
