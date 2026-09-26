"use client";

import { Suspense } from "react";
import { ChevronDown } from "lucide-react";
import { useQueryState, useQueryStates } from "nuqs";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCountry } from "@/lib/format";
import {
  COMBINATION_URL_KEYS,
  combinationParsers,
  countryParser,
} from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { CombinationsTable } from "./CombinationsTable";
import { KeywordCombinationsSkeleton } from "./skeletons";

const TITLE_ID = "keyword-combinations-title";

const LISTING_FIELDS: Record<Store, string> = {
  APP_STORE: "title, subtitle and keyword field",
  GOOGLE_PLAY: "title and short description",
};

export function KeywordCombinations({
  id,
  store,
  homeCountry,
  market,
}: {
  id: string;
  store: Store;
  homeCountry: string;
  market: string;
}) {
  const [params, setParams] = useQueryStates(combinationParsers, {
    urlKeys: COMBINATION_URL_KEYS,
  });
  const [, setCountry] = useQueryState("country", countryParser);
  const home = formatCountry(homeCountry);

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h3 id={TITLE_ID}>
            <button
              type="button"
              aria-expanded={params.open}
              onClick={() => void setParams({ open: !params.open })}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              Keyword combinations
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  params.open && "rotate-180",
                )}
              />
            </button>
          </h3>
        </CardTitle>
        <CardDescription>
          Every phrase of one to three words that the words in your{" "}
          {LISTING_FIELDS[store]} can form, in any order, and whether you track
          it in your home market. Coverage on the metadata page checks the
          reverse: whether each tracked keyword appears word for word in one
          field.
        </CardDescription>
      </CardHeader>
      {params.open ? (
        <CardContent role="region" aria-labelledby={TITLE_ID}>
          {market === homeCountry ? (
            <Suspense fallback={<KeywordCombinationsSkeleton />}>
              <CombinationsTable
                id={id}
                store={store}
                homeCountry={homeCountry}
                params={params}
                setParams={setParams}
              />
            </Suspense>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                Combinations come from the listing in your home market, {home}.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void setCountry(null)}
              >
                Switch to {home}
              </Button>
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
