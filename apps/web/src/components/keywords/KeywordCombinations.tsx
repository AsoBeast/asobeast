"use client";

import { Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useQueryState, useQueryStates } from "nuqs";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import {
  PANEL_ACTION,
  SECTION_CHEVRON,
  SECTION_TOGGLE,
} from "@/components/layout/panel-classes";
import { formatCountry, pluralize } from "@/lib/format";
import { buildCombinations } from "@/lib/keyword-combinations";
import {
  appDetailOptions,
  keywordFieldOptions,
  keywordsOptions,
} from "@/lib/queries";
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

function UntrackedCount({
  id,
  store,
  homeCountry,
}: {
  id: string;
  store: Store;
  homeCountry: string;
}) {
  const { data: app } = useQuery(appDetailOptions(id));
  const { data: tracked } = useQuery(keywordsOptions(id, homeCountry));
  const { data: field } = useQuery({
    ...keywordFieldOptions(id),
    enabled: store === "APP_STORE",
  });
  const untracked = useMemo(() => {
    if (!app || !tracked || (store === "APP_STORE" && !field)) return null;
    const { combinations, truncated } = buildCombinations({
      listing: {
        store,
        snapshot: app.latestSnapshot,
        keywordField: field?.tracked.map((keyword) => keyword.text) ?? [],
      },
      tracked,
      market: homeCountry,
    });
    const count = combinations.filter(
      ({ status }) => status === "untracked",
    ).length;
    return { count, truncated };
  }, [app, tracked, field, store, homeCountry]);
  if (untracked === null) return null;
  const phrases = pluralize(untracked.count, "untracked phrase");
  return (
    <span className="numeric">
      {untracked.truncated ? `At least ${phrases}. ` : `${phrases}. `}
    </span>
  );
}

export function KeywordCombinations({
  id,
  store,
  homeCountry,
  market,
  countUntracked,
}: {
  id: string;
  store: Store;
  homeCountry: string;
  market: string;
  countUntracked: boolean;
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
          <h2 id={TITLE_ID}>
            <button
              type="button"
              aria-expanded={params.open}
              onClick={() => void setParams({ open: !params.open })}
              className={SECTION_TOGGLE}
            >
              Keyword combinations
              <ChevronDown
                aria-hidden
                className={cn(SECTION_CHEVRON, !params.open && "-rotate-90")}
              />
            </button>
          </h2>
        </CardTitle>
        <CardAction className={PANEL_ACTION}>
          <InfoTip
            label="About keyword combinations"
            title="Keyword combinations"
            summary="Every phrase of one to three words that your listing words can form, in any order, and whether you track it in your home market. Coverage on the metadata page checks the reverse: whether each tracked keyword appears word for word in one field."
          />
        </CardAction>
      </CardHeader>
      {params.open ? (
        <CardContent
          role="region"
          aria-labelledby={TITLE_ID}
          className="flex flex-col gap-4"
        >
          <p className="text-body text-muted-foreground">
            {countUntracked && market === homeCountry ? (
              <UntrackedCount id={id} store={store} homeCountry={homeCountry} />
            ) : null}
            <span>{`Phrases the words in your ${LISTING_FIELDS[store]} can form.`}</span>
          </p>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body text-muted-foreground">
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
